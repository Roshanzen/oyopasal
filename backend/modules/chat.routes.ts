import { Router } from 'express';
import {
  AuthRequest,
  optionalAuth,
  requireAuth,
} from '../middleware/auth.ts';
import {
  createDirectOrderFromItems,
  handleChatConciergeTurn,
  UserLocationInput,
} from '../services/conciergeService.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();

// POST /api/v1/chat/ (Gemini 4 Hydrogen + Full PostgreSQL Data + Function Calling + Direct Checkout)
router.post(
  '/chat/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { messages, userLocation, language = 'en' } = req.body as {
      messages?: { role: string; content: string }[];
      userLocation?: UserLocationInput;
      language?: 'en' | 'ne';
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new ApiError(400, 'messages array is required', 'MISSING_MESSAGES');
    }

    const result = await handleChatConciergeTurn(req, {
      messages,
      userLocation,
      language,
    });
    res.json(result);
  })
);

// POST /api/v1/chat/direct-order/ (1-tap Direct Checkout from AI Concierge to Assigned Delivery Address)
router.post(
  '/chat/direct-order/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      items,
      address_id,
      delivery_address,
      payment_method,
      delivery_option,
      coupon_code,
      notes,
    } = req.body as {
      items?: { product_id: string; quantity: number; variant_id?: string }[];
      address_id?: string;
      delivery_address?: any;
      payment_method?: string;
      delivery_option?: string;
      coupon_code?: string | null;
      notes?: string;
    };

    const order = await createDirectOrderFromItems({
      authUser: req.authUser!,
      items: items || [],
      addressId: address_id,
      deliveryAddress: delivery_address,
      paymentMethod: payment_method,
      deliveryOption: delivery_option,
      couponCode: coupon_code,
      notes,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      order,
    });
  })
);

export default router;
