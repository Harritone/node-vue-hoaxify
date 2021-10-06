const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
});

const getUsers = async () => {
  return await request(app).get('/api/v1/users');
};

const addUsers = async (activeUsercount, inactiveUserCount = 0) => {
  for (let i = 0; i < activeUsercount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@mail.com`,
      inactive: i >= activeUsercount,
    });
  }
};

describe('Listing Users', () => {
  it('returns 200 ok when there are no users in db', async () => {
    const response = await request(app).get('/api/v1/users/');
    expect(response.status).toBe(200);
  });

  it('returns page object as response body', async () => {
    const response = await request(app).get('/api/v1/users/');
    expect(response.body).toEqual({
      content: [],
      page: 0,
      size: 10,
      totalPages: 0,
    });
  });

  it('returns 10 users in page content when thre are 11 users in db', async () => {
    await addUsers(11);
    const response = await getUsers();
    expect(response.body.content.length).toBe(10);
  });

  it('returns 6 users in page content when there are active 6 users and 5 inactive users in db', async () => {
    await addUsers(6, 5);
    const response = await getUsers();
    expect(response.body.content.length).toBe(6);
  });

  it('returns only id, username and email in content array for each user', async () => {
    await addUsers(11);
    const response = await getUsers();
    const user = response.body.content[0];
    expect(Object.keys(user)).toEqual(['id', 'username', 'email']);
  });
});
