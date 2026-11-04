import { useMemo } from 'react';

export default (t) =>
  useMemo(
    () => ({
      id: {
        name: t('deviceIdentifier'),
        type: 'number',
        property: true,
      },
      latitude: {
        name: t('positionLatitude'),
        type: 'number',
        property: true,
      },
      longitude: {
        name: t('positionLongitude'),
        type: 'number',
        property: true,
      },
      speed: {
        name: t('positionSpeed'),
        type: 'number',
        dataType: 'speed',
        property: true,
      },
      course: {
        name: t('positionCourse'),
        type: 'number',
        property: true,
      },
      altitude: {
        name: t('positionAltitude'),
        type: 'number',
        dataType: 'altitude',
        property: true,
      },
      accuracy: {
        name: t('positionAccuracy'),
        type: 'number',
        dataType: 'distance',
        property: true,
      },
      valid: {
        name: t('positionValid'),
        type: 'boolean',
        property: true,
      },
      protocol: {
        name: t('positionProtocol'),
        type: 'string',
        property: true,
      },
      address: {
        name: t('positionAddress'),
        type: 'string',
        property: true,
      },
      deviceTime: {
        name: t('positionDeviceTime'),
        type: 'string',
        property: true,
      },
      fixTime: {
        name: t('positionFixTime'),
        type: 'string',
        property: true,
      },
      serverTime: {
        name: t('positionServerTime'),
        type: 'string',
        property: true,
      },
      geofenceIds: {
        name: t('sharedGeofences'),
        property: true,
      },
      raw: {
        name: t('positionRaw'),
        type: 'string',
      },
      index: {
        name: t('positionIndex'),
        type: 'number',
      },
      hdop: {
        name: t('positionHdop'),
        type: 'number',
      },
      vdop: {
        name: t('positionVdop'),
        type: 'number',
      },
      pdop: {
        name: t('positionPdop'),
        type: 'number',
      },
      sat: {
        name: t('positionSat'),
        type: 'number',
      },
      satVisible: {
        name: t('positionSatVisible'),
        type: 'number',
      },
      rssi: {
        name: t('positionRssi'),
        type: 'number',
      },
      coolantTemp: {
        name: t('positionCoolantTemp'),
        type: 'number',
      },
      engineTemp: {
        name: t('positionEngineTemp'),
        type: 'number',
      },
      engineLoad: {
        name: t('positionEngineLoad'),
        type: 'number',
      },
      gps: {
        name: t('positionGps'),
        type: 'number',
      },
      roaming: {
        name: t('positionRoaming'),
        type: 'boolean',
      },
      event: {
        name: t('positionEvent'),
        type: 'string',
      },
      alarm: {
        name: t('positionAlarm'),
        type: 'string',
      },
      status: {
        name: t('positionStatus'),
        type: 'string',
      },
      odometer: {
        name: t('positionOdometer'),
        type: 'number',
        dataType: 'distance',
      },
      serviceOdometer: {
        name: t('positionServiceOdometer'),
        type: 'number',
        dataType: 'distance',
      },
      tripOdometer: {
        name: t('positionTripOdometer'),
        type: 'number',
        dataType: 'distance',
      },
      hours: {
        name: t('positionHours'),
        type: 'number',
        dataType: 'hours',
      },
      steps: {
        name: t('positionSteps'),
        type: 'number',
      },
      heartRate: {
        name: t('positionHeartRate'),
        type: 'number',
      },
      input: {
        name: t('positionInput'),
        type: 'number',
      },
      in1: {
        name: `${t('positionInput')} 1`,
        type: 'boolean',
      },
      in2: {
        name: `${t('positionInput')} 2`,
        type: 'boolean',
      },
      in3: {
        name: `${t('positionInput')} 3`,
        type: 'boolean',
      },
      in4: {
        name: `${t('positionInput')} 4`,
        type: 'boolean',
      },
      output: {
        name: t('positionOutput'),
        type: 'number',
      },
      out1: {
        name: `${t('positionOutput')} 1`,
        type: 'boolean',
      },
      out2: {
        name: `${t('positionOutput')} 2`,
        type: 'boolean',
      },
      out3: {
        name: `${t('positionOutput')} 3`,
        type: 'boolean',
      },
      out4: {
        name: `${t('positionOutput')} 4`,
        type: 'boolean',
      },
      power: {
        name: t('positionPower'),
        type: 'number',
        dataType: 'voltage',
      },
      battery: {
        name: t('positionBattery'),
        type: 'number',
        dataType: 'voltage',
      },
      batteryLevel: {
        name: t('positionBatteryLevel'),
        type: 'number',
        dataType: 'percentage',
      },
      fuel: {
        name: t('positionFuel'),
        type: 'number',
        dataType: 'volume',
      },
      fuelUsed: {
        name: t('positionFuelUsed'),
        type: 'number',
        dataType: 'volume',
      },
      fuelConsumption: {
        name: t('positionFuelConsumption'),
        type: 'number',
      },
      fuelLevel: {
        name: t('positionFuelLevel'),
        type: 'number',
      },
      energy: {
        name: t('positionEnergy'),
        type: 'number',
        dataType: 'energy',
      },
      energyLevel: {
        name: t('positionEnergyLevel'),
        type: 'number',
        dataType: 'percentage',
      },
      versionFw: {
        name: t('positionVersionFw'),
        type: 'string',
      },
      versionHw: {
        name: t('positionVersionHw'),
        type: 'string',
      },
      type: {
        name: t('sharedType'),
        type: 'string',
      },
      ignition: {
        name: t('positionIgnition'),
        type: 'boolean',
      },
      business: {
        name: t('positionBusiness'),
        type: 'boolean',
      },
      flags: {
        name: t('positionFlags'),
        type: 'string',
      },
      antenna: {
        name: t('positionAntenna'),
        type: 'boolean',
      },
      charge: {
        name: t('positionCharge'),
        type: 'boolean',
      },
      ip: {
        name: t('positionIp'),
        type: 'string',
      },
      archive: {
        name: t('positionArchive'),
        type: 'boolean',
      },
      distance: {
        name: t('positionDistance'),
        type: 'number',
        dataType: 'distance',
      },
      totalDistance: {
        name: t('deviceTotalDistance'),
        type: 'number',
        dataType: 'distance',
      },
      rpm: {
        name: t('positionRpm'),
        type: 'number',
      },
      vin: {
        name: t('positionVin'),
        type: 'string',
      },
      approximate: {
        name: t('positionApproximate'),
        type: 'boolean',
      },
      throttle: {
        name: t('positionThrottle'),
        type: 'number',
      },
      motion: {
        name: t('positionMotion'),
        type: 'boolean',
      },
      armed: {
        name: t('positionArmed'),
        type: 'boolean',
      },
      geofence: {
        name: t('sharedGeofence'),
        type: 'string',
      },
      acceleration: {
        name: t('positionAcceleration'),
        type: 'number',
      },
      humidity: {
        name: t('positionHumidity'),
        type: 'number',
      },
      deviceTemp: {
        name: t('positionDeviceTemp'),
        type: 'number',
      },
      temp1: {
        name: `${t('positionTemp')} 1`,
        type: 'number',
      },
      temp2: {
        name: `${t('positionTemp')} 2`,
        type: 'number',
      },
      temp3: {
        name: `${t('positionTemp')} 3`,
        type: 'number',
      },
      temp4: {
        name: `${t('positionTemp')} 4`,
        type: 'number',
      },
      operator: {
        name: t('positionOperator'),
        type: 'string',
      },
      command: {
        name: t('deviceCommand'),
        type: 'string',
      },
      blocked: {
        name: t('positionBlocked'),
        type: 'boolean',
      },
      lock: {
        name: t('alarmLock'),
        type: 'boolean',
      },
      door: {
        name: t('alarmDoor'),
        type: 'boolean',
      },
      axleWeight: {
        name: t('positionAxleWeight'),
        type: 'number',
      },
      gSensor: {
        name: t('positionGSensor'),
        type: 'string',
      },
      iccid: {
        name: t('positionIccid'),
        type: 'string',
      },
      phone: {
        name: t('sharedPhone'),
        type: 'string',
      },
      dtcs: {
        name: t('positionDtcs'),
        type: 'string',
      },
      obdSpeed: {
        name: t('positionObdSpeed'),
        type: 'number',
        dataType: 'speed',
      },
      obdOdometer: {
        name: t('positionObdOdometer'),
        type: 'number',
        dataType: 'distance',
      },
      result: {
        name: t('eventCommandResult'),
        type: 'string',
      },
      driverUniqueId: {
        name: t('sharedDriver'),
        type: 'string',
      },
      card: {
        name: t('positionCard'),
        type: 'string',
      },
      drivingTime: {
        name: t('positionDrivingTime'),
        type: 'number',
        dataType: 'hours',
      },
      faultCount: {
        name: t('positionFaultCount'),
        type: 'number',
      },
      milDistance: {
        name: t('positionMilDistance'),
        type: 'number',
      },
      hybridBatteryLevel: {
        name: t('positionHybridBatteryLevel'),
        type: 'number',
      },
      batteryCurrent: {
        name: t('positionBatteryCurrent'),
        type: 'number',
      },
      dataMode: {
        name: t('positionDataMode'),
        type: 'number',
      },
      sleepMode: {
        name: t('positionSleepMode'),
        type: 'number',
      },
      axisX: {
        name: t('positionAxisX'),
        type: 'number',
      },
      axisY: {
        name: t('positionAxisY'),
        type: 'number',
      },
      axisZ: {
        name: t('positionAxisZ'),
        type: 'number',
      },
      cid2g: {
        name: t('positionCid2g'),
        type: 'number',
      },
      cid4g: {
        name: t('positionCid4g'),
        type: 'number',
      },
      lac: {
        name: t('positionLac'),
        type: 'number',
      },
      shortFuelTrim: {
        name: t('positionShortFuelTrim'),
        type: 'number',
      },
      fuelPressure: {
        name: t('positionFuelPressure'),
        type: 'number',
      },
      intakeMap: {
        name: t('positionIntakeMap'),
        type: 'number',
      },
      timingAdvance: {
        name: t('positionTimingAdvance'),
        type: 'number',
      },
      intakeTemp: {
        name: t('positionIntakeTemp'),
        type: 'number',
      },
      maf: {
        name: t('positionMaf'),
        type: 'number',
      },
      engineRuntime: {
        name: t('positionEngineRuntime'),
        type: 'number',
      },
      relativeFuelRailPressure: {
        name: t('positionRelativeFuelRailPressure'),
        type: 'number',
      },
      directFuelRailPressure: {
        name: t('positionDirectFuelRailPressure'),
        type: 'number',
      },
      commandedEgr: {
        name: t('positionCommandedEgr'),
        type: 'number',
      },
      egrError: {
        name: t('positionEgrError'),
        type: 'number',
      },
      distanceSinceCodesCleared: {
        name: t('positionDistanceSinceCodesCleared'),
        type: 'number',
      },
      barometricPressure: {
        name: t('positionBarometricPressure'),
        type: 'number',
      },
      controlModuleVoltage: {
        name: t('positionControlModuleVoltage'),
        type: 'number',
      },
      absoluteLoad: {
        name: t('positionAbsoluteLoad'),
        type: 'number',
      },
      ambientTemp: {
        name: t('positionAmbientTemp'),
        type: 'number',
      },
      milTime: {
        name: t('positionMilTime'),
        type: 'number',
      },
      timeSinceCodesCleared: {
        name: t('positionTimeSinceCodesCleared'),
        type: 'number',
      },
      absoluteFuelRailPressure: {
        name: t('positionAbsoluteFuelRailPressure'),
        type: 'number',
      },
      oilTemp: {
        name: t('positionOilTemp'),
        type: 'number',
      },
      fuelInjectionTiming: {
        name: t('positionFuelInjectionTiming'),
        type: 'number',
      },
      fuelRate: {
        name: t('positionFuelRate'),
        type: 'number',
      },
      equivalenceRatio: {
        name: t('positionEquivalenceRatio'),
        type: 'number',
      },
      intakeMap2: {
        name: t('positionIntakeMap2'),
        type: 'number',
      },
      hybridSystemVoltage: {
        name: t('positionHybridSystemVoltage'),
        type: 'number',
      },
      hybridSystemCurrent: {
        name: t('positionHybridSystemCurrent'),
        type: 'number',
      },
      fuelType: {
        name: t('positionFuelType'),
        type: 'number',
      },
      gnssStatus: {
        name: t('positionGnssStatus'),
        type: 'number',
      },
      networkType: {
        name: t('positionNetworkType'),
        type: 'number',
      },
      instantMovement: {
        name: t('positionInstantMovement'),
        type: 'boolean',
      },
      axlCalibration: {
        name: t('positionAxlCalibration'),
        type: 'number',
      },
      ignitionCount: {
        name: t('positionIgnitionCount'),
        type: 'number',
      },
      ecoScore: {
        name: t('positionEcoScore'),
        type: 'number',
      },
      greenDrivingValue: {
        name: t('positionGreenDrivingValue'),
        type: 'number',
      },
      greenDrivingDuration: {
        name: t('positionGreenDrivingDuration'),
        type: 'number',
      },
      overspeedSpeed: {
        name: t('positionOverspeedSpeed'),
        type: 'number',
      },
      gnssJamming: {
        name: t('positionGnssJamming'),
        type: 'number',
      },
      color: {
        name: t('attributeColor'),
        type: 'string',
      },
      image: {
        name: t('positionImage'),
        type: 'string',
      },
      video: {
        name: t('positionVideo'),
        type: 'string',
      },
      audio: {
        name: t('positionAudio'),
        type: 'string',
      },
      speedLimit: {
        name: t('attributeSpeedLimit'),
        type: 'number',
        dataType: 'speed',
      },
    }),
    [t],
  );
