import Homey from 'homey';
import EnphaseAPI from './iqbattery_EnphaseAPI.mjs';

export default class EnphaseDriver extends Homey.Driver {

  async onPair(session) {
    let api;
    let username;
    let password;

    session.setHandler('login', async data => {
      username = data.username;
      password = data.password;

      try {
        api = new EnphaseAPI({
          username,
          password,
        });
        await api.login();
        return true;
      } catch (err) {
        this.error(`Login Error: ${err.message}`);
        return false;
      }
    });

    session.setHandler('list_devices', async () => {
      const siteIds = await api.getSiteIds();
      this.log(`Site IDs: ${siteIds}`);

      const result = [];
      for (const siteId of siteIds) {
        const siteData = await api.getSiteData({ siteId });
        result.push({
          name: siteData?.module?.info?.title || `System ${siteId}`,
          data: { siteId },
          settings: {
            username,
            password,
          },
        });
      }
      return result;
    });
  }

};
