import { registerUser, loginUser, changePassword } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const result = await registerUser(req.body);
  res.status(201).json({
    success: true,
    data: result,
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.body);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const changeUserPassword = asyncHandler(async (req, res) => {
  const result = await changePassword(req.user.sub, req.body);
  res.status(200).json({
    success: true,
    data: result,
  });
});
