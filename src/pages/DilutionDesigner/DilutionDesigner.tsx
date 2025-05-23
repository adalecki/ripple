import React, { useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { usePreferences } from '../../hooks/usePreferences';
import { analyzeDilutionPoints } from './utils/dilutionUtils';
import { DilutionSettings, DilutionSettingsErrors, Point } from './types/dilutionTypes';
import DilutionSettingsInput from './components/DilutionSettings';
import DilutionStocksInput from './components/DilutionStocks';
import DilutionPointsInput from './components/DilutionPoints';
import DilutionGraph from './components/DilutionGraph';

import './css/DilutionDesigner.css'

const DilutionDesigner: React.FC = () => {
  const { preferences } = usePreferences();

  const [settings, setSettings] = useState<DilutionSettings>({
    stockConcentrations: [10000],
    maxTransferVolume: preferences.maxTransferVolume as number,
    dropletSize: preferences.dropletSize as number,
    dmsoLimit: preferences.defaultDMSOTolerance as number,
    backfillVolume: preferences.defaultBackfill as number,
    assayVolume: preferences.defaultAssayVolume as number,
    allowableError: preferences.defaultAllowedError as number,
    useIntConcs: preferences.useIntermediatePlates as boolean,
    numIntConcs: 5 as number
  });

  const [errors, setErrors] = useState<DilutionSettingsErrors>({});

  const [points, setPoints] = useState<Point[]>([
    { concentration: 30, index: 0 },
    { concentration: 10, index: 1 },
    { concentration: 3, index: 2 },
    { concentration: 1, index: 3 },
    { concentration: 0.3, index: 4 },
    { concentration: 0.1, index: 5 }
  ]);

  const validateSettings = (newSettings: Partial<DilutionSettings>, key: keyof DilutionSettings): string | undefined => {
    switch (key) {
      case 'maxTransferVolume':
        if (!newSettings.maxTransferVolume || newSettings.maxTransferVolume <= 0) {
          return 'Must be greater than 0';
        }
        break;
      case 'dmsoLimit':
        if (!newSettings.dmsoLimit || newSettings.dmsoLimit <= 0 || newSettings.dmsoLimit >= 1) {
          return 'Must be between 0 and 1';
        }
        break;
      case 'backfillVolume':
        if (!newSettings.backfillVolume || newSettings.backfillVolume <= 0) {
          return 'Must be greater than 0';
        }
        break;
      case 'assayVolume':
        if (!newSettings.assayVolume || newSettings.assayVolume <= 0) {
          return 'Must be greater than 0';
        }
        break;
      case 'allowableError':
        if (!newSettings.allowableError || newSettings.allowableError <= 0 || newSettings.allowableError >= 1) {
          return 'Must be between 0 and 1';
        }
        break;
      case 'numIntConcs':
        if (!newSettings.numIntConcs || newSettings.numIntConcs <= 0 || newSettings.numIntConcs >= 21) {
          return 'Must be between 1 and 20 inclusive';
        }
        break;
    }
    return undefined;
  };

  const handleSettingChange = (key: keyof DilutionSettings, value: any) => {
    const newSettings = {
      ...settings,
      [key]: value
    };

    const error = validateSettings(newSettings, key);

    setErrors(prevErrors => {
      if (error) {
        return {
          ...prevErrors,
          [key]: error,
        };
      } else {
        const { [key as keyof DilutionSettingsErrors]: removedKey, ...rest } =
          prevErrors;
        return rest;
      }
    });

    if (!error || typeof value === 'boolean') {
      setSettings(newSettings);
    }
  };
  
  const analysisResults = analyzeDilutionPoints({
    points: points.map(p => p.concentration),
    stockConcentrations: settings.stockConcentrations,
    constraints: {
      dropletSize: settings.dropletSize,
      maxTransferVolume: settings.maxTransferVolume,
      assayVolume: settings.assayVolume * 1000,
      allowableError: settings.allowableError,
      dmsoLimit: settings.dmsoLimit,
      backfillVolume: settings.backfillVolume * 1000
    },
    useIntConcs: settings.useIntConcs,
    numIntConcs: settings.numIntConcs
  });

  return (
    <Container fluid className="dilution-designer">
      <Row>
        <Col md={2} className="designer-column">
          <DilutionSettingsInput
            settings={settings}
            onSettingChange={handleSettingChange}
            errors={errors}
          />
        </Col>
        <Col md={2} className="designer-column middle-column">
          <div className="middle-section">
            <DilutionPointsInput
              points={points}
              onPointsChange={setPoints}
            />
          </div>
          <div className="middle-section">
            <DilutionStocksInput
              settings={settings}
              onSettingsChange={setSettings}
            />
          </div>
        </Col>
        <Col md={8} className="designer-column">
          <DilutionGraph
            points={points}
            analysisResults={analysisResults}
            allowableError={settings.allowableError}
          />
        </Col>
      </Row>
    </Container>
  );
};

export default DilutionDesigner;