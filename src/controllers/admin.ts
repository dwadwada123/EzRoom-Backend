import { Request, Response } from 'express';
import { Contract } from '../models/contract';
import { User } from '../models/user';
import { Room } from '../models/room';
import { Property } from '../models/property';
import { Invoice } from '../models/invoice';
import { RoomReview } from '../models/roomReview';
import { RenterReview } from '../models/renterReview';
import { ReviewReport } from '../models/reviewReport';
import { processEscrowDisbursals } from '../tasks/escrow';
import { sendNotificationHelper } from './notification';

export async function getAdminContracts(req: Request, res: Response) {
  try {
    const contracts = await Contract.find({});
    return res.status(200).json(contracts);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}



export async function getPendingEkyc(req: Request, res: Response) {
  try {
    // Return users who submitted eKYC docs
    const pendingUsers = await User.find({
      isEkycVerified: false,
      role: 'HOST',
      ekycStatus: { $in: ['PENDING', 'REJECTED'] },
      idCardNumber: { $exists: true, $ne: '' }
    });
    return res.status(200).json(pendingUsers);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function moderateEkyc(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { action, note } = req.body; // APPROVE or REJECT
    if (!action) {
      return res.status(400).json({ success: false, error: 'Action is required.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    if (action === 'APPROVE') {
      user.isEkycVerified = true;
      user.ekycStatus = 'VERIFIED';
      
      await sendNotificationHelper(
        user._id,
        'Xác thực danh tính thành công',
        'Hồ sơ eKYC của bạn đã được Admin phê duyệt. Bạn có thể đăng tin và nhận đặt cọc.',
        'SYSTEM',
        user._id
      );
    } else if (action === 'REJECT') {
      user.isEkycVerified = false;
      user.ekycStatus = 'REJECTED';
      user.ekycRejectReason = note || 'Hồ sơ không hợp lệ';
      
      await sendNotificationHelper(
        user._id,
        'Xác thực danh tính bị từ chối',
        `Lý do: ${user.ekycRejectReason}. Vui lòng kiểm tra lại và nộp lại hồ sơ.`,
        'SYSTEM',
        user._id
      );
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action. Must be APPROVE or REJECT.' });
    }

    await user.save();
    return res.status(200).json({ success: true, message: `eKYC successfully moderated to ${action}.`, user });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRoomsModeration(req: Request, res: Response) {
  try {
    const { status } = req.query;
    const filter: any = {};
    if (status) {
      filter.status = status;
    }
    const rooms = await Room.find(filter).lean();
    const populated = await Promise.all(rooms.map(async (room: any) => {
      let propertyName = 'Phòng lẻ độc lập';
      let propertyType = 'SINGLE';
      let hostName = 'Chủ nhà hệ thống';
      let commonAmenities: any[] = [];

      if (room.propertyId) {
        const prop = await Property.findById(room.propertyId).lean();
        if (prop) {
          propertyName = prop.name;
          propertyType = prop.type;
          commonAmenities = prop.commonAmenities || [];
          const host = await User.findById(prop.hostId).lean();
          if (host) {
            hostName = host.name;
          }
        }
      } else if (room.hostId) {
        const host = await User.findById(room.hostId).lean();
        if (host) {
          hostName = host.name;
        }
      }

      return {
        ...room,
        id: room._id, // Map for frontend convenience
        propertyName,
        propertyType,
        hostName,
        commonAmenities,
        priceFormatted: new Intl.NumberFormat('vi-VN').format(room.price) + ' đ/tháng'
      };
    }));

    return res.status(200).json(populated);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}



export async function moderateRoom(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // APPROVE, REJECT, LOCK, HIDE
    if (!action) {
      return res.status(400).json({ success: false, error: 'Action is required.' });
    }

    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found.' });
    }

    if (action === 'APPROVE') {
      room.status = 'ACTIVE';
      room.reports = [];
    } else if (action === 'KEEP' || action === 'DISMISS_REPORTS') {
      room.reports = [];
      room.status = 'ACTIVE';
      console.log(`[ROOM MODERATION] Dismissed reports and kept room "${room.title}"`);
    } else if (action === 'REJECT' || action === 'LOCK') {
      room.status = 'REMOVED';
      room.removalInfo = {
        reason: reason || 'Moderator action',
        dateRemoved: new Date().toLocaleDateString('vi-VN')
      };
    } else if (action === 'HIDE') {
      room.status = 'HIDDEN';
    } else {
      return res.status(400).json({ success: false, error: 'Invalid moderation action.' });
    }

    await room.save();

    // Trigger Notification to Host
    if (room.hostId) {
      const statusTitle = action === 'APPROVE' ? 'Phòng trọ được phê duyệt' : 'Cập nhật duyệt phòng';
      const statusMsg = action === 'APPROVE' 
        ? `Phòng trọ "${room.title}" của bạn đã được phê duyệt và hiển thị công khai.`
        : `Phòng trọ "${room.title}" của bạn đã chuyển sang trạng thái ${action}. Lý do: ${reason || 'Không có'}`;
      await sendNotificationHelper(room.hostId, statusTitle, statusMsg, 'MODERATION', room._id);
    }

    return res.status(200).json({ success: true, message: 'Room successfully moderated.', room });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}


export async function triggerEscrowTask(req: Request, res: Response) {
  const processed = await processEscrowDisbursals();
  return res.status(200).json({ success: true, processed });
}

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const totalUsers = await User.countDocuments({});
    const totalHosts = await User.countDocuments({ role: 'HOST' });
    const ekycHosts = await User.countDocuments({ role: 'HOST', isEkycVerified: true });
    const totalRenters = await User.countDocuments({ role: 'RENTER' });

    const totalProperties = await Property.countDocuments({});
    const complexProperties = await Property.countDocuments({ type: 'COMPLEX' });
    const singleProperties = await Property.countDocuments({ type: 'SINGLE' });

    const totalRooms = await Room.countDocuments({});
    const activeRooms = await Room.countDocuments({ status: 'ACTIVE' });
    const pendingRooms = await Room.countDocuments({ status: 'PENDING' });

    const pendingEkyc = await User.countDocuments({ ekycStatus: 'PENDING', role: 'HOST' });

    // B-09: Dynamically calculate the last 6 months from today
    const monthlyStats: Record<string, { deposit: number, commission: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = (d.getMonth() + 1).toString().padStart(2, '0');
      const yearStr = d.getFullYear().toString();
      const period = `${monthStr}/${yearStr}`;
      monthlyStats[period] = { deposit: 0, commission: 0 };
    }

    // Accumulate deposits from contracts (depositAmount is in VNĐ, convert to Millions)
    const contracts = await Contract.find({ depositStatus: { $in: ['FROZEN', 'DISBURSED'] } });
    contracts.forEach(c => {
      const parts = c.dateCreated.split('/');
      if (parts.length === 3) {
        const monthStr = parts[1].padStart(2, '0');
        const period = `${monthStr}/${parts[2]}`;
        if (monthlyStats[period]) {
          monthlyStats[period].deposit += c.depositAmount / 1000000;
        }
      }
    });

    // Accumulate system commissions from invoices
    const invoices = await Invoice.find({ status: 'PAID' });
    invoices.forEach(inv => {
      const parts = inv.period.split('/');
      if (parts.length === 2) {
        const monthStr = parts[0].padStart(2, '0');
        const normalizedPeriod = `${monthStr}/${parts[1]}`;
        if (monthlyStats[normalizedPeriod]) {
          const comm = inv.commission || Math.round((inv.roomPrice || 0) * 0.05);
          monthlyStats[normalizedPeriod].commission += comm / 1000000;
        }
      }
    });

    const analyticsData = Object.keys(monthlyStats).sort().map(period => ({
      name: `Tháng ${parseInt(period.split('/')[0])}`,
      deposit: parseFloat(monthlyStats[period].deposit.toFixed(2)),
      commission: parseFloat(monthlyStats[period].commission.toFixed(2))
    }));

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalHosts,
        ekycHostsPercent: totalHosts > 0 ? Math.round((ekycHosts / totalHosts) * 100) : 0,
        totalRenters,
        totalProperties,
        complexProperties,
        singleProperties,
        totalRooms,
        activeRooms,
        pendingRooms,
        pendingEkyc
      },
      analyticsData
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getAdminDisputes(req: Request, res: Response) {
  try {
    const disputes = await Contract.find({ status: 'DISPUTED' }).lean();

    // Also fetch rooms with takedown appeals where appealText actually exists
    const appealedRooms = await Room.find({
      'removalInfo.appealText': { $exists: true, $ne: '' }
    }).lean();

    const mappedAppeals = await Promise.all(appealedRooms.map(async (r: any) => {
      let hostName = 'Chủ trọ';
      if (r.hostId) {
        const h = await User.findById(r.hostId).lean();
        if (h) hostName = h.name || h.phone || 'Chủ trọ';
      }
      return {
        _id: r._id,
        id: r._id,
        type: 'LISTING_DISPUTE',
        roomName: r.title,
        hostName: hostName,
        renterName: `${hostName} (Kháng cáo gỡ phòng)`,
        disputeReason: r.removalInfo?.appealText || r.removalInfo?.reason || 'Kháng cáo gỡ bài đăng phòng trọ',
        proofImages: r.removalInfo?.appealImages || [],
        dateCreated: r.removalInfo?.appealDate || r.removalInfo?.dateRemoved || 'Mới đây',
        status: r.removalInfo?.appealStatus === 'APPROVED' || r.removalInfo?.appealStatus === 'REJECTED' ? 'APPROVED' : 'PENDING',
        rawAppealStatus: r.removalInfo?.appealStatus || 'PENDING',
        depositAmount: 0
      };
    }));

    return res.status(200).json([...disputes, ...mappedAppeals]);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function resolveDispute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body; // APPROVED or REJECTED
    if (!status || !resolutionNote) {
      return res.status(400).json({ success: false, error: 'Missing status or resolution note.' });
    }

    const contract = await Contract.findById(id);
    if (contract) {
      if (status === 'APPROVED') {
        // Approve renter claim -> refund Renter
        contract.depositStatus = 'REFUNDED';
        contract.status = 'TERMINATED';
        contract.refundInfo = {
          bankName: contract.refundInfo?.bankName || 'Demo Bank',
          accountNumber: contract.refundInfo?.accountNumber || '123456',
          accountOwner: contract.refundInfo?.accountOwner || contract.renterName,
          status: 'COMPLETED'
        };
      } else if (status === 'REJECTED') {
        // Reject renter claim -> disburse to Host
        contract.depositStatus = 'DISBURSED';
        contract.status = 'ACTIVE';
        contract.disburseDate = new Date().toLocaleDateString('vi-VN');
      } else {
        return res.status(400).json({ success: false, error: 'Invalid resolution status.' });
      }

      await contract.save();
      return res.status(200).json({ success: true, message: 'Dispute resolved.', contract });
    }

    // Check if it's a Room Takedown Appeal
    const room = await Room.findById(id);
    if (room) {
      if (status === 'APPROVED') {
        room.status = 'ACTIVE';
        room.removalInfo = null;
        room.reports = [];
        console.log(`[ROOM APPEAL APPROVED] Restored room "${room.title}" to ACTIVE.`);
        if (room.hostId) {
          await sendNotificationHelper(
            room.hostId,
            'Kháng cáo phòng được chấp nhận',
            `Kháng cáo cho phòng trọ "${room.title}" đã được Admin phê duyệt. Phòng đã được khôi phục hiển thị công khai.`,
            'MODERATION',
            room._id
          );
        }
      } else {
        if (room.removalInfo) {
          room.removalInfo.appealStatus = 'REJECTED';
        }
        room.status = 'REMOVED';
        console.log(`[ROOM APPEAL REJECTED] Maintained room "${room.title}" REMOVED status.`);
        if (room.hostId) {
          await sendNotificationHelper(
            room.hostId,
            'Kháng cáo phòng bị từ chối',
            `Kháng cáo cho phòng trọ "${room.title}" đã bị từ chối. Quyết định khóa/gỡ phòng giữ nguyên.`,
            'MODERATION',
            room._id
          );
        }
      }
      await room.save();
      return res.status(200).json({ success: true, message: 'Room appeal resolved.', room });
    }

    return res.status(404).json({ success: false, error: 'Target contract or room not found.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getAdminUsers(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 0;
    const skip = limit > 0 ? (page - 1) * limit : 0;

    const query = User.find({}).sort({ _id: -1 });
    if (limit > 0) query.skip(skip).limit(limit);

    const [users, total] = await Promise.all([
      query.exec(),
      User.countDocuments({})
    ]);

    // Populate actual violation counts for Hosts & creditScore defaults for Renters
    const enrichedUsers = await Promise.all(users.map(async (u) => {
      const obj = u.toObject() as any;
      if (obj.role === 'HOST') {
        const hostProps = await Property.find({ hostId: obj._id }).select('_id').lean();
        const propIds = hostProps.map(p => p._id);
        const removedRoomsCount = await Room.countDocuments({
          $and: [
            { status: 'REMOVED' },
            {
              $or: [
                { propertyId: { $in: propIds } },
                { hostId: obj._id }
              ]
            }
          ]
        });
        obj.violations = (obj.violations || 0) + removedRoomsCount;
        obj.totalViolations = obj.violations;
      } else if (obj.role === 'RENTER') {
        const filterIds = [obj._id.toString(), obj.phone].filter(Boolean);
        const renterReviews = await RenterReview.find({ renterId: { $in: filterIds }, isDeleted: { $ne: true } }).lean();
        if (renterReviews.length > 0) {
          const avg = renterReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / renterReviews.length;
          obj.creditScore = parseFloat(avg.toFixed(1));
          obj.reviewCount = renterReviews.length;
        } else {
          obj.creditScore = null;
          obj.reviewCount = 0;
        }
      }
      return obj;
    }));

    return res.status(200).json({ users: enrichedUsers, total, page, limit: limit || total });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function toggleUserStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, lockReason } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    user.status = status;
    user.lockReason = lockReason || '';
    if (status === 'LOCKED') {
      user.violations = (user.violations || 0) + 1;
      user.totalViolations = (user.totalViolations || 0) + 1;
    }
    await user.save();

    return res.status(200).json({ success: true, message: 'User status updated successfully.', user });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getAdminInvoices(req: Request, res: Response) {
  try {
    const statusFilter = req.query.status as string;
    const invoiceFilter: any = {};
    if (statusFilter && statusFilter !== 'ALL') {
      invoiceFilter.status = statusFilter;
    } else {
      invoiceFilter.status = 'PAID';
    }

    const [invoices, depositContracts] = await Promise.all([
      Invoice.find(invoiceFilter).lean(),
      Contract.find({ depositStatus: { $in: ['FROZEN', 'DISBURSED', 'REFUNDED'] } }).lean()
    ]);

    const mappedInvoices = Array.isArray(invoices) ? invoices.map((inv: any) => ({
      ...inv,
      id: inv._id ? inv._id.toString() : inv.id,
      type: 'RENT',
      commission: Math.round((inv.roomPrice || 0) * 0.05)
    })) : [];

    const depositTxList = await Promise.all(depositContracts.map(async (c: any) => {
      let roomRentPrice = c.monthlyRent || 0;
      if (!roomRentPrice && c.roomId) {
        const r = await Room.findById(c.roomId).lean();
        if (r && r.price) roomRentPrice = r.price;
      }
      if (!roomRentPrice) roomRentPrice = c.depositAmount || 0;

      return {
        _id: `dep_${c._id}`,
        id: `dep_${c._id}`,
        contractId: c._id ? c._id.toString() : '',
        roomId: c.roomId,
        roomName: c.roomName || 'Phòng trọ',
        hostName: c.hostName || 'Chủ trọ hệ thống',
        period: 'Đặt cọc giữ phòng',
        roomPrice: roomRentPrice,
        amount: c.depositAmount || 0,
        paymentMethod: 'VietQR (Escrow)',
        type: 'DEPOSIT',
        commission: 0, // Non-rent deposit transactions have 0 commission
        dateCreated: c.dateCreated || 'Mới đây',
        status: c.depositStatus === 'FROZEN' ? 'PAID' : c.depositStatus === 'REFUNDED' ? 'REFUNDED' : 'DISBURSED',
        oldElectricity: 0,
        newElectricity: 0,
        oldWater: 0,
        newWater: 0,
        otherCosts: []
      };
    }));

    return res.status(200).json([...mappedInvoices, ...depositTxList]);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}



export async function getAdminReviewReports(req: Request, res: Response) {
  try {
    const reports = await ReviewReport.find({}).sort({ createdAt: -1 }).lean();

    // Group reports by reviewId
    const grouped = new Map<string, any[]>();
    reports.forEach(rep => {
      const key = rep.reviewId;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(rep);
    });

    const enriched = await Promise.all(Array.from(grouped.entries()).map(async ([reviewId, reportList]) => {
      const firstReport = reportList[0];
      const reviewType = firstReport.reviewType;

      let targetReview: any = null;
      let targetRoomTitle = '';
      let targetRoomId = '';

      if (reviewType === 'ROOM') {
        targetReview = await RoomReview.findById(reviewId).lean();
        if (targetReview && targetReview.roomId) {
          targetRoomId = targetReview.roomId;
          const targetRoom = await Room.findById(targetReview.roomId).lean();
          if (targetRoom) {
            targetRoomTitle = targetRoom.title;
          }
        }
      } else if (reviewType === 'RENTER') {
        targetReview = await RenterReview.findById(reviewId).lean();
      }

      // Count reason frequency and sort from most to least
      const counts: Record<string, number> = {};
      reportList.forEach(r => {
        const reasonStr = r.reason || 'Khác';
        counts[reasonStr] = (counts[reasonStr] || 0) + 1;
      });

      const sortedReasons = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => `${reason} (${count} lượt)`)
        .join('; ');

      const pendingStatus = reportList.some(r => r.status === 'PENDING') ? 'PENDING' : reportList[0].status;

      return {
        _id: firstReport._id,
        id: firstReport._id.toString(),
        reviewId,
        reviewType,
        reporterId: firstReport.reporterId,
        reporterName: reportList.map(r => r.reporterName).filter(Boolean).join(', ') || 'Người dùng',
        reporterRole: firstReport.reporterRole || (firstReport.reporterName?.includes('Chủ') ? 'HOST' : 'RENTER'),
        reason: sortedReasons,
        proofImages: reportList.flatMap(r => r.proofImages || []),
        status: pendingStatus,
        createdAt: firstReport.createdAt,
        totalReports: reportList.length,
        targetReviewContent: targetReview ? targetReview.comment : 'Bài đánh giá không tồn tại hoặc đã bị gỡ',
        targetReviewRating: targetReview ? targetReview.rating : 0,
        targetRoomTitle,
        targetRoomId
      };
    }));

    return res.status(200).json(enriched);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function resolveReviewReport(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { action, adminNote } = req.body; // DELETE_REVIEW or DISMISS

    // Find the report to get reviewId
    const report = await ReviewReport.findById(id);
    const reviewId = report ? report.reviewId : id;

    const allReportsForReview = await ReviewReport.find({ reviewId });

    if (action === 'DELETE_REVIEW') {
      // SOFT DELETE the review
      let targetRenterId = '';

      if (report?.reviewType === 'ROOM' || !report) {
        // Soft delete the RoomReview
        const roomRev = await RoomReview.findByIdAndUpdate(reviewId, { isDeleted: true }, { new: false });

        // Recalculate room and property rating
        if (roomRev) {
          const targetRoomId = (roomRev as any).roomId;

          // Recalculate active room reviews rating
          const activeRoomReviews = await RoomReview.find({ roomId: targetRoomId, isDeleted: { $ne: true } });
          const newRoomRating = activeRoomReviews.length > 0
            ? activeRoomReviews.reduce((sum, r) => sum + r.rating, 0) / activeRoomReviews.length
            : 0;
          const updatedRoom = await Room.findByIdAndUpdate(
            targetRoomId,
            { rating: parseFloat(newRoomRating.toFixed(1)), reviewCount: activeRoomReviews.length },
            { new: true }
          );

          // Recalculate property rating
          if (updatedRoom && updatedRoom.propertyId) {
            const { Property } = await import('../models/property');
            const propertyRooms = await Room.find({ propertyId: updatedRoom.propertyId });
            const propertyRoomIds = propertyRooms.map(r => r._id.toString());
            const activePropertyReviews = await RoomReview.find({
              roomId: { $in: propertyRoomIds },
              isDeleted: { $ne: true }
            });
            if (activePropertyReviews.length > 0) {
              const propAvgRating = activePropertyReviews.reduce((sum, r) => sum + r.rating, 0) / activePropertyReviews.length;
              await Property.findByIdAndUpdate(updatedRoom.propertyId, {
                rating: parseFloat(propAvgRating.toFixed(1)),
                reviewCount: activePropertyReviews.length
              });
            } else {
              await Property.findByIdAndUpdate(updatedRoom.propertyId, { rating: 0, reviewCount: 0 });
            }
          }

          console.log(`[REVIEW REPORT RESOLVED] Recalculated rating for room ${targetRoomId}: ${newRoomRating.toFixed(1)} (${activeRoomReviews.length} reviews)`);
        }
      }

      if (report?.reviewType === 'RENTER' || !report) {
        // Soft delete the RenterReview
        const renterRev = await RenterReview.findByIdAndUpdate(reviewId, { isDeleted: true }, { new: false });
        if (renterRev) targetRenterId = renterRev.renterId;

        // Recalculate renter credit score
        if (targetRenterId) {
          const activeRenterReviews = await RenterReview.find({
            renterId: targetRenterId,
            isDeleted: { $ne: true }
          });
          const newCreditScore = activeRenterReviews.length > 0
            ? activeRenterReviews.reduce((sum, r) => sum + r.rating, 0) / activeRenterReviews.length
            : 5.0; // Default score if no reviews remain

          await User.findOneAndUpdate(
            { $or: [{ _id: targetRenterId }, { phone: targetRenterId }] },
            { creditScore: parseFloat(newCreditScore.toFixed(1)) }
          );

          console.log(`[REVIEW REPORT RESOLVED] Recalculated creditScore for renter ${targetRenterId}: ${newCreditScore.toFixed(1)} (${activeRenterReviews.length} reviews)`);
        }
      }

      // Update all report records for this review to RESOLVED
      await ReviewReport.updateMany(
        { reviewId },
        { status: 'RESOLVED', adminNote: adminNote || 'Đã duyệt gỡ bài đánh giá vi phạm (Xóa mềm)' }
      );

      console.log(`[REVIEW REPORT RESOLVED] Soft deleted review ${reviewId}`);
    } else if (action === 'DISMISS') {
      // Mark all report records for this review as DISMISSED
      await ReviewReport.updateMany(
        { reviewId },
        { status: 'DISMISSED', adminNote: adminNote || 'Bác bỏ báo cáo khiếu nại' }
      );
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action. Must be DELETE_REVIEW or DISMISS' });
    }

    return res.status(200).json({ success: true, message: 'Report resolved successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

