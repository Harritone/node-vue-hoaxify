const User = require('./User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Sequelize = require('sequelize');
const emailService = require('../email/emailService');
const sequelize = require('../config/database');
const EmailException = require('../email/EmailException');
const InvalidTokenEception = require('./InvalidTokenException');
const UserNotFoundException = require('../error/UserNotFoundException');

const generateToken = (length) => {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
};

const save = async (body) => {
  const { username, email, password } = body;
  const hash = await bcrypt.hash(password, 10);
  const user = { username, email, password: hash, activationToken: generateToken(16) };
  // const user = Object.assign({}, req.body, { password: hash });
  const transaction = await sequelize.transaction();
  await User.create(user, { transaction });
  try {
    await emailService.sendAccountActivation(email, user.activationToken);
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw new EmailException();
  }
};

const findByEmail = async (email) => {
  return await User.findOne({ where: { email: email } });
};

const activate = async (token) => {
  const user = await User.findOne({ where: { activationToken: token } });
  if (!user) {
    throw new InvalidTokenEception();
  }
  user.inactive = false;
  user.activationToken = null;
  await user.save();
};

const getUsers = async (page, size, authenticatedUser) => {
  const usersWithCounts = await User.findAndCountAll({
    where: {
      inactive: false,
      id: {
        [Sequelize.Op.not]: authenticatedUser ? authenticatedUser.id : 0,
      },
    },
    attributes: ['id', 'username', 'email'],
    limit: size,
    offset: +page * size,
  });

  return {
    content: usersWithCounts.rows,
    page: +page,
    size,
    totalPages: Math.ceil(usersWithCounts.count / size),
  };
};

const getUser = async (id) => {
  const user = await User.findOne({ where: { id: id, inactive: false }, attributes: ['id', 'username', 'email'] });
  if (!user) {
    throw new UserNotFoundException();
  }
  return user;
};

const updateUser = async (id, updatedBody) => {
  const user = await User.findOne({ where: { id: id } });
  user.username = updatedBody.username;
  await user.save();
};

module.exports = { save, findByEmail, activate, getUsers, getUser, updateUser };
