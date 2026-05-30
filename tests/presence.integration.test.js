const User = require('../models/User/User');
const Session = require('../models/Others/Session');

jest.mock('../models/User/User', () => ({
  create: jest.fn(),
  update: jest.fn(),
  findAll: jest.fn(),
  destroy: jest.fn(),
}));

jest.mock('../models/Others/Session', () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
}));

describe('Presence persistence integration', () => {
  beforeEach(() => {
    jest.resetModules();
    User.create.mockResolvedValue({ id: 100001 });
    User.update.mockResolvedValue([1]);
    User.findAll.mockResolvedValue([]);
    User.destroy.mockResolvedValue(1);
    Session.findOne.mockResolvedValue(null);
    Session.findAll.mockResolvedValue([]);
  });

  test('markUserOffline persists lastSeenAt and init reloads it', async () => {
    // create a test user
    const user = await User.create({ name: 'presence-test', email: `presence-test-${Date.now()}@example.com`, password: 'pass123' });
    const userId = user.id;

    // load presenceService freshly
    const presence = require('../services/presenceService');

    // mark online then offline
    presence.markUserOnline(userId);
    const ts = new Date();
    await presence.markUserHeartbeat(userId, ts);
    Session.findOne.mockResolvedValue({
      loginAt: new Date(ts.getTime() - 5 * 60 * 1000),
      logoutAt: null,
      save: jest.fn().mockResolvedValue(true),
    });
    await presence.markUserOffline(userId);

    // reload module to simulate restart
    jest.resetModules();
    const UserReloaded = require('../models/User/User');
    const SessionReloaded = require('../models/Others/Session');
    UserReloaded.findAll.mockResolvedValue([{ id: userId, lastSeenAt: ts }]);
    SessionReloaded.findAll.mockResolvedValue([{ userId, loginAt: ts, logoutAt: null }]);
    const presence2 = require('../services/presenceService');
    await presence2.init();

    const p = presence2.getPresence(userId);
    expect(p.lastSeenAt).not.toBeNull();
    const loaded = new Date(p.lastSeenAt).getTime();
    expect(Math.abs(loaded - ts.getTime())).toBeLessThan(60 * 1000); // within 1 minute

    // cleanup
    await User.destroy({ where: { id: userId } });
  }, 20000);
});
