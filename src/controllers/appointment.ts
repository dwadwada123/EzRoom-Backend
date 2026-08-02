import { Request, Response } from 'express';
import { Appointment } from '../models/appointment';
import { Room } from '../models/room';
import { User } from '../models/user';
import { sendNotificationHelper } from './notification';

export async function createAppointment(req: Request, res: Response) {
  try {
    let { id, _id, roomId, roomName, renterId, renterName, renterPhone, hostId, hostName, date, time, note, status } = req.body;
    id = id || _id;
    if (!id || !roomId || !roomName || !renterName || !renterPhone || !hostName || !date || !time) {
      return res.status(400).json({ success: false, error: 'Missing required appointment fields' });
    }

    const room = await Room.findById(roomId);
    if (room && room.hostId) {
      hostId = room.hostId;
    }

    if (!renterId) {
      const renterUser = await User.findOne({ phone: renterPhone.trim() });
      if (renterUser) {
        renterId = renterUser._id;
      }
    }

    const appointment = new Appointment({
      _id: id,
      roomId,
      roomName,
      renterId: renterId || '',
      renterName,
      renterPhone,
      hostId: hostId || '',
      hostName,
      date,
      time,
      note: note || '',
      status: status || 'PENDING'
    });
    await appointment.save();

    // Trigger Notification to Host
    const targetHostId = hostId || (room ? room.hostId : null);
    if (targetHostId) {
      await sendNotificationHelper(
        targetHostId,
        'Lịch hẹn xem phòng mới',
        `${renterName} vừa đặt lịch hẹn xem phòng "${roomName}" vào ${time} ngày ${date}.`,
        'APPOINTMENT',
        appointment._id
      );
    }

    return res.status(201).json({ success: true, appointment });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getAppointments(req: Request, res: Response) {
  try {
    const { renterName, hostName, renterId, hostId, phone } = req.query;
    const filter: any = {};
    const orConditions: any[] = [];

    if (renterId) orConditions.push({ renterId });
    if (hostId) orConditions.push({ hostId });
    if (renterName) orConditions.push({ renterName });
    if (hostName) orConditions.push({ hostName });
    if (phone) orConditions.push({ renterPhone: phone });

    if (orConditions.length > 0) {
      filter.$or = orConditions;
    }

    const appointments = await Appointment.find(filter).lean();
    const mapped = appointments.map((a: any) => ({ ...a, id: a._id }));
    return res.status(200).json(mapped);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateAppointmentStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, date, time } = req.body;
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    const caller = (req as any).user;
    if (!caller) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const callerUser = await User.findById(caller.id);
    if (!callerUser) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const isHost = appointment.hostId?.toString() === caller.id || appointment.hostName === callerUser.name;
    const isRenter = appointment.renterId?.toString() === caller.id || appointment.renterPhone === callerUser.phone || appointment.renterName === callerUser.name;
    
    if (!isHost && !isRenter) {
      return res.status(403).json({ success: false, error: 'Forbidden: Not your appointment.' });
    }

    if (status) appointment.status = status;
    if (date) appointment.date = date;
    if (time) appointment.time = time;
    await appointment.save();

    // Find renter user to send notification
    let targetRenterId = appointment.renterId;
    if (!targetRenterId) {
      const renter = await User.findOne({ $or: [{ phone: appointment.renterPhone }, { name: appointment.renterName }] });
      if (renter) targetRenterId = renter._id;
    }

    if (targetRenterId) {
      const statusText = status === 'APPROVED' ? 'đã được ĐỒNG Ý' : status === 'CANCELED' ? 'đã bị TỪ CHỐI/HỦY' : 'đã được cập nhật';
      await sendNotificationHelper(
        targetRenterId,
        'Trạng thái lịch hẹn',
        `Lịch hẹn xem phòng "${appointment.roomName}" ${statusText}.`,
        'APPOINTMENT',
        appointment._id
      );
    }

    return res.status(200).json({ success: true, appointment });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

