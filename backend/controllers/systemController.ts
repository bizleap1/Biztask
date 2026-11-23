import { Request, Response } from 'express';

export const clearAllData = async (req: Request, res: Response) => {
  // Mass deletion is disabled to guarantee data safety and prevent accidental destruction
  return res.status(403).json({
    error: {
      code: 'MASS_DELETION_DISABLED',
      message: 'Mass clear-all data operation is permanently disabled to ensure zero data loss.'
    }
  });
};

export const flushOldData = async (req: Request, res: Response) => {
  return res.status(403).json({
    error: {
      code: 'FORBIDDEN',
      message: 'Automated data flushing is handled via scheduled background jobs, not direct API triggers.'
    }
  });
};
