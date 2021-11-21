// const jwt = require('jsonwebtoken');
const { randomString } = require('../shared/generator');
const Token = require('./Token');

const createToken = async (user) => {
  const token = randomString(32);
  await Token.create({
    token,
    userId: user.id,
  });
  return token;
  // return jwt.sign({ id: user.id }, 'this-is-my-secret', { expiresIn: 600 });
};

const verify = async (token) => {
  // return await jwt.verify(token, 'this-is-my-secret');
  const tokenInDB = await Token.findOne({ where: { token: token } });
  const userId = tokenInDB.userId;
  return { id: userId };
};

const removeToken = async (token) => {
  // const tokenInDB = await Token.findOne({ where: { token: token } });
  // await tokenInDB.destroy();
  await Token.destroy({ where: { token: token } });
};

module.exports = {
  createToken,
  verify,
  removeToken,
};
