const User = require('./User');
const bcrypt = require('bcrypt');

const save = async (body) => {
  const hash = await bcrypt.hash(body.password, 10);
  const user = { ...body, password: hash };
  // const user = Object.assign({}, req.body, { password: hash });
  await User.create(user);
};

const findByEmail = async (email) => {
  const user = await User.findOne({ where: { email: email } });
  if (user) {
    throw new Error('been_taken');
  }
};

module.exports = { save, findByEmail };
