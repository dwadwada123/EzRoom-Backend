import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { RoomReview } from '../models/roomReview';
import { Room } from '../models/room';
import { User } from '../models/user';
import { ReviewReport } from '../models/reviewReport';

export async function createRoomReview(req: Request, res: Response) {
  try {
    const { roomId, rating, comment } = req.body;
    const reviewerId = (req as any).user?.id || req.body.reviewerId;

    if (!roomId || !reviewerId || rating === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const finalComment = comment !== undefined ? String(comment) : '';

    const review = new RoomReview({
      roomId: String(roomId),
      reviewerId: String(reviewerId),
      rating: Number(rating),
      comment: finalComment,
      createdAt: new Date()
    });

    await review.save();

    const roomReviews = await RoomReview.find({ roomId: String(roomId), isDeleted: { $ne: true } });
    const roomAvgRating = roomReviews.reduce((acc, r) => acc + r.rating, 0) / roomReviews.length;
    
    if (mongoose.Types.ObjectId.isValid(String(roomId))) {
      const room = await Room.findByIdAndUpdate(roomId, { rating: roomAvgRating, reviewCount: roomReviews.length }, { new: true });

      if (room && room.propertyId && mongoose.Types.ObjectId.isValid(room.propertyId)) {
        const propertyRooms = await Room.find({ propertyId: room.propertyId });
        const propertyRoomIds = propertyRooms.map(r => r._id.toString());
        const allPropertyReviews = await RoomReview.find({ roomId: { $in: propertyRoomIds }, isDeleted: { $ne: true } });
        if (allPropertyReviews.length > 0) {
          const propAvgRating = allPropertyReviews.reduce((acc, r) => acc + r.rating, 0) / allPropertyReviews.length;
          await import('../models/property').then(m => {
            return m.Property.findByIdAndUpdate(room.propertyId, { rating: propAvgRating, reviewCount: allPropertyReviews.length });
          });
        }
      }
    }

    return res.status(201).json({ success: true, review });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRoomReviews(req: Request, res: Response) {
  try {
    const roomId = String(req.params.roomId || '');
    
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'Room ID is required' });
    }

    const reviews = await RoomReview.find({ roomId, isDeleted: { $ne: true } }).sort({ createdAt: -1 });

    const enrichedReviews = [];
    for (const review of reviews) {
      const user = mongoose.Types.ObjectId.isValid(review.reviewerId) ? await User.findById(review.reviewerId) : null;
      enrichedReviews.push({
        id: review._id.toString(),
        reviewerName: user ? user.name : 'Người dùng',
        reviewerAvatar: user ? user.avatarUrl : null,
        rating: review.rating,
        comment: review.comment,
        isReported: review.isReported || false,
        reportReason: review.reportReason || '',
        createdAt: review.createdAt.toISOString()
      });
    }

    return res.status(200).json(enrichedReviews);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function reportRoomReview(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason, proofImages, reporterName, reporterId } = req.body;

    const review = await RoomReview.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    const currentReporterId = reporterId || (req as any).user?.id || '';
    const currentReporterName = reporterName || (req as any).user?.name || 'Người dùng';
    const currentRole = (req as any).user?.role || 'RENTER';

    // Anti-spam check: check if this account already reported this review while pending
    const queryConditions: any[] = [{ reporterName: currentReporterName }];
    if (currentReporterId) {
      queryConditions.push({ reporterId: currentReporterId });
    }

    const existing = await ReviewReport.findOne({
      reviewId: id,
      status: 'PENDING',
      $or: queryConditions
    });

    if (existing) {
      return res.status(400).json({ success: false, error: 'Bạn đã báo cáo đánh giá này rồi. Báo cáo đang chờ Admin xử lý.' });
    }

    const reportReasonText = reason || 'Nội dung không phù hợp';
    const imagesList = Array.isArray(proofImages) ? proofImages : [];

    review.isReported = true;
    review.reportReason = reportReasonText;
    await review.save();

    // Create Admin ReviewReport entry
    const report = new ReviewReport({
      reviewId: id,
      reviewType: 'ROOM',
      reporterId: currentReporterId,
      reporterName: currentReporterName,
      reporterRole: currentRole,
      reason: reportReasonText,
      proofImages: imagesList,
      status: 'PENDING',
      createdAt: new Date()
    });
    await report.save();

    console.log('[REVIEW REPORT CREATED FOR ADMIN]:', report);

    return res.status(200).json({ success: true, message: 'Đã gửi báo cáo vi phạm tới Admin thành công', report });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
