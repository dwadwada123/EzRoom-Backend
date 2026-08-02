import { Request, Response } from 'express';
import { RenterReview } from '../models/renterReview';
import { User } from '../models/user';

async function updateRenterCreditScore(renterIdentifier: string) {
  try {
    const user = await User.findOne({
      $or: [
        { _id: renterIdentifier },
        { phone: renterIdentifier }
      ]
    });

    const filterIds = [renterIdentifier];
    if (user) {
      filterIds.push(user._id.toString());
      filterIds.push(user.phone);
    }

    const renterReviews = await RenterReview.find({ renterId: { $in: filterIds }, isDeleted: { $ne: true } });
    const averageRating = renterReviews.length > 0 
      ? renterReviews.reduce((sum, r) => sum + r.rating, 0) / renterReviews.length 
      : 5.0;

    const roundedScore = parseFloat(averageRating.toFixed(1));

    if (user) {
      user.creditScore = roundedScore;
      await user.save();
      console.log(`[CREDIT SCORE] Updated creditScore to ${roundedScore} for user ${user.name} (${user.phone})`);
    }
  } catch (err) {
    console.error('[CREDIT SCORE] Recalculation error:', err);
  }
}

export async function createReview(req: Request, res: Response) {
  try {
    console.log('[RENTER REVIEW POST BODY]:', req.body);
    const { id, _id, renterId, hostName, rating, tags, comment, date } = req.body;
    const reviewId = id || _id;
    const finalComment = comment !== undefined ? comment : '';
    const finalDate = date || new Date().toLocaleDateString('vi-VN');

    if (!reviewId || !renterId || !hostName || rating === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required review fields (reviewId, renterId, hostName, rating)' });
    }

    // Save review
    const review = new RenterReview({ 
      _id: reviewId, 
      renterId, 
      hostName, 
      rating, 
      tags: tags || [], 
      comment: finalComment, 
      date: finalDate,
      isDeleted: false
    });
    await review.save();

    await updateRenterCreditScore(renterId);

    const formatted = {
      id: review._id,
      _id: review._id,
      renterId: review.renterId,
      hostName: review.hostName,
      rating: review.rating,
      tags: review.tags,
      comment: review.comment,
      date: review.date
    };

    return res.status(201).json({ success: true, review: formatted });
  } catch (error: any) {
    console.error('[RENTER REVIEW ERROR]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRenterReviews(req: Request, res: Response) {
  try {
    const { renterId } = req.params;
    if (!renterId) {
      return res.status(400).json({ success: false, error: 'Renter ID is required' });
    }

    const user = await User.findOne({
      $or: [
        { _id: renterId },
        { phone: renterId }
      ]
    });

    const filterIds = [renterId];
    if (user) {
      filterIds.push(user._id.toString());
      filterIds.push(user.phone);
    }

    const reviews = await RenterReview.find({ renterId: { $in: filterIds }, isDeleted: { $ne: true } }).sort({ date: -1 });
    const formatted = reviews.map(r => ({
      id: r._id,
      _id: r._id,
      renterId: r.renterId,
      hostName: r.hostName,
      rating: r.rating,
      tags: r.tags || [],
      comment: r.comment || '',
      date: r.date || ''
    }));

    return res.status(200).json(formatted);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateReview(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { rating, tags, comment, date } = req.body;

    const review = await RenterReview.findById(id);
    if (!review || review.isDeleted) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    if (rating !== undefined) review.rating = rating;
    if (tags !== undefined) review.tags = tags;
    if (comment !== undefined) review.comment = comment;
    if (date !== undefined) review.date = date;

    await review.save();
    await updateRenterCreditScore(review.renterId);

    const formatted = {
      id: review._id,
      _id: review._id,
      renterId: review.renterId,
      hostName: review.hostName,
      rating: review.rating,
      tags: review.tags,
      comment: review.comment,
      date: review.date
    };

    return res.status(200).json({ success: true, review: formatted });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteReview(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const review = await RenterReview.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    const renterId = review.renterId;
    review.isDeleted = true;
    await review.save();

    await updateRenterCreditScore(renterId);

    return res.status(200).json({ success: true, message: 'Review deleted successfully (soft delete)' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function reportRenterReview(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason, proofImages, reporterName, reporterId } = req.body;

    const review = await RenterReview.findById(id);
    if (!review || review.isDeleted) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    const { ReviewReport } = await import('../models/reviewReport');
    const currentReporterId = reporterId || (req as any).user?.id || '';
    const currentReporterName = reporterName || (req as any).user?.name || 'Người dùng';
    const currentRole = (req as any).user?.role || 'HOST';

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

    const reportReasonText = reason || 'Nội dung đánh giá không đúng sự thật';
    const imagesList = Array.isArray(proofImages) ? proofImages : [];

    const report = new ReviewReport({
      reviewId: id,
      reviewType: 'RENTER',
      reporterId: currentReporterId,
      reporterName: currentReporterName,
      reporterRole: currentRole,
      reason: reportReasonText,
      proofImages: imagesList,
      status: 'PENDING',
      createdAt: new Date()
    });
    await report.save();

    console.log('[RENTER REVIEW REPORT CREATED FOR ADMIN]:', report);

    return res.status(200).json({ success: true, message: 'Đã gửi báo cáo vi phạm tới Admin thành công', report });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

