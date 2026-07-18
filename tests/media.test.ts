import request from 'supertest';
import app from '../src/app';
import cloudinary from '../src/config/cloudinary';

// Mock Cloudinary uploader.upload_stream
jest.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options: any, callback?: any) => {
  const mockWritableStream: any = {
    write: jest.fn(),
    end: jest.fn(() => {
      if (callback) {
        callback(null, { secure_url: 'https://res.cloudinary.com/mock_cloud/image/upload/v12345/room_image.jpg' });
      }
    }),
  };
  return mockWritableStream;
});

describe('POST /api/media/upload', () => {
  it('should upload a mock image file to Cloudinary and return secure URL', async () => {
    const res = await request(app)
      .post('/api/media/upload')
      .attach('file', Buffer.from('fake image content'), 'test.png')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.url).toBe('https://res.cloudinary.com/mock_cloud/image/upload/v12345/room_image.jpg');
  });

  it('should return 400 bad request if no file is provided', async () => {
    const res = await request(app)
      .post('/api/media/upload')
      .expect(400);

    expect(res.body.success).toBe(false);
  });
});
