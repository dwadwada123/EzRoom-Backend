import { Router } from 'express';
import {
  addFavorite,
  removeFavorite,
  savePaymentAccount,
  deletePaymentAccount,
  setDefaultPaymentAccount
} from '../controllers/userProfile';

const router = Router();

router.post('/profile/favorites', addFavorite);
router.post('/profile/favorites/remove', removeFavorite);
router.post('/profile/payment-accounts', savePaymentAccount);
router.post('/profile/payment-accounts/delete', deletePaymentAccount);
router.post('/profile/payment-accounts/default', setDefaultPaymentAccount);

export default router;
