const app = require('./src/app');
const sequelize = require('./src/config/database');

sequelize.sync({ force: true });

app.listen(3000, () => {
  console.log('App is running at port 3000');
});
