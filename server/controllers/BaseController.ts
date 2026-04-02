import type { Response } from 'express';

export class BaseController {
  protected success(res: Response, data: any, message?: string) {
    return res.status(200).json({
      success: true,
      message,
      data,
    });
  }

  protected error(res: Response, message: string, status: number = 400) {
    return res.status(status).json({
      success: false,
      message,
    });
  }

  protected unauthorized(res: Response, message: string = 'Unauthorized') {
    return this.error(res, message, 401);
  }

  protected forbidden(res: Response, message: string = 'Forbidden') {
    return this.error(res, message, 403);
  }

  protected notFound(res: Response, message: string = 'Not Found') {
    return this.error(res, message, 404);
  }
}
