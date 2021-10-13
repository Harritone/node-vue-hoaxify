const app = require('./src/app');
const sequelize = require('./src/config/database');
const User = require('./src/user/User');
const bcrypt = require('bcrypt');

const addUser = async (activeUsercount, inactiveUserCount = 0) => {
  const hash = await bcrypt.hash('P4ssword', 10);
  for (let i = 0; i < activeUsercount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@mail.com`,
      inactive: i >= activeUsercount,
      password: hash,
    });
  }
};

sequelize.sync({ force: true }).then(async () => {
  await addUser(25);
  console.log('added');
});

app.listen(3000, () => {
  console.log('App is running at port 3000');
});
