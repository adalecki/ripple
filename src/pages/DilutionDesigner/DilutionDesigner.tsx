import React, { useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { usePreferences } from '../../hooks/usePreferences';
import { analyzeMultipleStockConcentrations } from '../EchoTransfer/utils/echoUtils';
import { DilutionSettings, Point } from './types/dilutionTypes';
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
    useIntConcs: preferences.useIntermediatePlates as boolean
  });

  const [points, setPoints] = useState<Point[]>([
    { concentration: 30, index: 0 },
    { concentration: 10, index: 1 },
    { concentration: 3, index: 2 },
    { concentration: 1, index: 3 },
    { concentration: 0.3, index: 4 },
    { concentration: 0.1, index: 5 }
  ]);

  // Calculate achievable ranges based on current settings
  const rangeAnalysis = analyzeMultipleStockConcentrations({
    stockConcentrations: settings.stockConcentrations,
    constraints: {
      maxTransferVolume: settings.maxTransferVolume,
      dropletSize: settings.dropletSize,
      dmsoLimit: settings.dmsoLimit,
      backfillVolume: settings.backfillVolume * 1000,
      assayVolume: settings.assayVolume * 1000,
      allowableError: settings.allowableError
    },
    maxIntermediateLevels: (settings.useIntConcs ? 2 : 0)
  });

  return (
    <Container fluid className="dilution-designer">
      <Row>
        <Col md={2} className="designer-column">
          <DilutionSettingsInput 
            settings={settings}
            onSettingsChange={setSettings}
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
            ranges={rangeAnalysis.ranges}
          />
        </Col>
      </Row>
    </Container> 
  );
};

export default DilutionDesigner;