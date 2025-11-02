'use server';

import { checkAndDeductCredit } from '@/lib/utils/credits';

export async function deductCreditAction(userId: string, actionType: string) {
  return checkAndDeductCredit(userId, actionType);
}

