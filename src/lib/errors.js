// Lỗi có chủ đích (404, 403, 400...). Error handler sẽ hiển thị thông báo thân thiện.
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.expose = status < 500; // chỉ hiện message cho người dùng với lỗi 4xx
  }
}

export const notFound = (message = 'The page or item you asked for was not found.') =>
  new AppError(404, message);
export const forbidden = (message = 'You are not allowed to do this.') =>
  new AppError(403, message);
export const badRequest = (message = 'Invalid request.') => new AppError(400, message);
