export function resumeFileFilter(req, file, cb) {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  if (!allowed.includes(file.mimetype)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return cb(new Error('Unsupported file type'), false);
  }
  cb(null, true);
}
