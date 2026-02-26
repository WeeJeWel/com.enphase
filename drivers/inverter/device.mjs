import https from 'https';
import fetch from 'node-fetch';
import EnphaseDevice from '../../lib/EnphaseDevice.mjs';

export default class EnphaseDeviceInverter extends EnphaseDevice {

  localAgent = new https.Agent({
    rejectUnauthorized: false,
  });
  localSerialNumber = null;
  localAddress = null;
  localToken = null;

  async onInit() {
    await super.onInit();

    const { siteId } = this.getData();
    this.log(`Site ID: ${siteId}`);

    if (this.homey.platform === 'local') {
      this.discoveryStrategy = this.homey.discovery.getStrategy('enphase-envoy');
      this.discoveryStrategy.on('result', discoveryResult => {
        this.onDiscoveryResult(discoveryResult);
      });

      const discoveryResults = this.discoveryStrategy.getDiscoveryResults()
      for (const discoveryResult of Object.values(discoveryResults)) {
        this.onDiscoveryResult(discoveryResult);
      }
    }
  }

  async onPollCloud() {
    await super.onPollCloud();

    const { siteId } = this.getData();

    const siteData = await this.api.getSiteData({ siteId });
    const todayData = await this.api.getSiteToday({ siteId });

    // this.log('siteData', JSON.stringify(siteData, null, 2));
    // this.log('todayData', JSON.stringify(todayData, null, 2));

    // This has been commented out because the data did not correspond to the actual power generation :(
    // const measurePower = todayData?.latest_power?.value; // in W
    // if (typeof measurePower === 'number') {
    //   await this.setCapabilityValue('measure_power', measurePower)
    //     .catch(err => this.error('Error setting measure_power:', err));
    // }

    const meterPower = siteData?.module?.lifetime?.lifetimeEnergy?.value; // in Wh
    if (typeof meterPower === 'number') {
      await this.setCapabilityValue('meter_power', meterPower / 1000)
        .catch(err => this.error('Error setting meter_power:', err));
    }

    const meterPowerDay = todayData?.stats?.[0]?.totals?.production; // in Wh
    if (typeof meterPowerDay === 'number') {
      await this.setCapabilityValue('meter_power.day', meterPowerDay / 1000)
        .catch(err => this.error('Error setting meter_power.day:', err));
    }

    // Microinverters
    await Promise.resolve().then(async () => {
      const { inverters = [] } = await this.api.getInverters({ siteId });
      for (const inverter of inverters) {
        const inverterSerialNumber = inverter.serial_number;
        if (!inverterSerialNumber) continue;

        try {
          const capabilityIdStatus = `inverter_microinverter_status.${inverterSerialNumber}`;
          await this.removeCapability(capabilityIdStatus).catch(() => { });
          if (!this.hasCapability(capabilityIdStatus)) {
            await this.addCapability(capabilityIdStatus);
            await this.setCapabilityOptions(capabilityIdStatus, {
              title: `${inverter.serial_number} Status`,
            });
          }

          await this.setCapabilityValue(capabilityIdStatus, inverter.statusText);
        } catch (err) {
          this.error(`Error Setting Microinverter ${inverterSerialNumber}: ${err.message}`);
        }
      }
    }).catch(err => this.error(`Error Looping Microinverters: ${err.message}`));
  }

  async onPollLocal() {
    await super.onPollLocal();

    if (!this.localAddress) return;
    if (!this.localSerialNumber) return;

    if (!this.localToken) {
      this.localToken = await this.api.getEntrezToken({
        serialNumber: this.localSerialNumber,
      });
    }

    const res = await fetch(`https://${this.localAddress}/production.json?details=1`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.localToken}`,
      },
      agent: this.localAgent,
    });

    switch (res.status) {
      case 200: {
        const body = await res.json();

        if (Array.isArray(body.production)) {
          const productionInverters = body.production.find(item => item.type === 'inverters');
          if (productionInverters) {
            if (typeof productionInverters.wNow === 'number') {
              await Promise.resolve().then(async () => {
                if (!this.hasCapability('measure_power')) {
                  await this.addCapability('measure_power');
                }

                await this.setCapabilityValue('measure_power', productionInverters.wNow);
              }).catch(err => this.error('Error Setting measure_power:', err));
            }

            // This is disabled, because it might interfere with the cloud values.
            // We don't want jumping insights.
            // if (typeof productionInverters.whLifetime === 'number') {
            //   await Promise.resolve().then(async () => {
            //     if (!this.hasCapability('meter_power')) {
            //       await this.addCapability('meter_power');
            //     }

            //     await this.setCapabilityValue('meter_power', productionInverters.whLifetime / 1000);
            //   }).catch(err => this.error('Error Setting meter_power:', err));
            // }
          }
        }

        break;
      }
      case 401: {
        this.log('Local Token Expired');
        this.localToken = null;
        break;
      }
      default: {
        throw new Error(res.statusText);
      }
    };
  }

  onDiscoveryResult(discoveryResult) {
    this.log(`Local Envoy Found: ${discoveryResult.address} — S/N: ${discoveryResult.txt.serialnum}`);

    this.localToken = null;
    this.localAddress = discoveryResult.address;
    this.localSerialNumber = discoveryResult.txt.serialnum;

    discoveryResult.once('addressChanged', () => {
      this.log(`Local Envoy Address Changed: ${this.localAddress} → ${discoveryResult.address}`);
      this.localAddress = discoveryResult.address;
    });

    this.pollLocal();
  }

};