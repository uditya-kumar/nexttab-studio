// The one error type routes send to the browser: { error, code } with an HTTP status.
export class AppError extends Error {
  constructor(message, { status = 500, code = "error" } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message) => new AppError(message, { status: 400, code: "bad_request" });
