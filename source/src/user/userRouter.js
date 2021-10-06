const express = require('express');
const UserService = require('./UserService');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const ValidationException = require('../error/ValidationException');

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
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // const validationErrors = {};
      // return res.status(400).send({ validationErrors });
      return next(new ValidationException(errors.array()));
    }
    try {
      await UserService.save(req.body);
      return res.send({ message: req.t('user_created') });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/api/v1/users/token/:token', async (req, res, next) => {
  const token = req.params.token;
  try {
    await UserService.activate(token);
    return res.send({ message: req.t('account_activation_success') });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/users', async (req, res) => {
  let page = req.query.page ? +req.query.page : 0;
  if (page < 0) page = 0;
  const users = await UserService.getUsers(page);
  res.send(users);
});

module.exports = router;
