import { supabase } from '@/lib/supabaseServer';
import logger from '@/lib/logger';

type DeductCreditResponse = {
  success: boolean;
  creditsRemaining: number;
  error?: string;
};

type DeductCreditResultPayload = {
  credits_remaining: number;
};

const INSUFFICIENT_CREDITS_CODE = 'INSUFFICIENT_CREDITS';

export async function checkAndDeductCredit(
  userId: string,
  actionType: string
): Promise<DeductCreditResponse> {
  try {
    const { data, error } = await supabase.rpc<DeductCreditResultPayload>(
      'deduct_credit',
      {
        user_uuid: userId,
        action: actionType
      }
    );

    if (error) {
      if (error.code === INSUFFICIENT_CREDITS_CODE) {
        return {
          success: false,
          creditsRemaining: data?.credits_remaining ?? 0,
          error: 'INSUFFICIENT_CREDITS'
        };
      }

      logger.error('Failed to deduct credits', {
        error,
        userId,
        actionType
      });

      return {
        success: false,
        creditsRemaining: data?.credits_remaining ?? 0,
        error: error.message
      };
    }

    return {
      success: true,
      creditsRemaining: data?.credits_remaining ?? 0
    };
  } catch (error) {
    logger.error('Unexpected error when deducting credits', {
      error,
      userId,
      actionType
    });

    return {
      success: false,
      creditsRemaining: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

