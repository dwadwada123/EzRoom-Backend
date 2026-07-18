import { Router, Request, Response } from 'express';
import { upload } from '../middlewares/multer';
import cloudinary from '../config/cloudinary';

const router = Router();

router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded.' });
  }

  // Stream upload directly to cloudinary
  const stream = cloudinary.uploader.upload_stream(
    { folder: 'ezroom' },
    (error, result) => {
      if (error || !result) {
        console.error('Cloudinary upload error:', error);
        return res.status(500).json({ success: false, error: 'Upload failed.' });
      }
      return res.status(200).json({ success: true, url: result.secure_url });
    }
  );

  stream.end(req.file.buffer);
});

export default router;
