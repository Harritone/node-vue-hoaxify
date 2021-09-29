const express = require('express');
const UserService = require('./UserService');
const router = express.Router();
const { check, validationResult } = require('express-validator');

router.post(
  '/api/v1/users',
  check('username').notEmpty().withMessage('blank').bail().isLength({ min: 4, max: 32 }).withMessage('username_size'),
  check('email')
    .notEmpty()
    .withMessage('blank')
    .bail()
    .isEmail()
    .withMessage('not_valid')
    .bail()
    .custom(UserService.findByEmail),
  check('password')
    .notEmpty()
    .withMessage('blank')
    .bail()
    .isLength({ min: 6 })
    .withMessage('password_size')
    .bail()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
    .withMessage('password_chars'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const validationErrors = {};
      errors.array().forEach((error) => {
        validationErrors[error.param] = req.t(error.msg);
      });
      return res.status(400).send({ validationErrors });
    }
    await UserService.save(req.body);
    return res.send({ message: req.t('user_created') });
  }
);

module.exports = router;
