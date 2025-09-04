import React, { useCallback, useEffect, useState } from 'react';
import { Row, Card, Button } from 'react-bootstrap';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import CurveCard from './CurveCard';
import { Plate } from '../../../classes/PlateClass';
import { Protocol } from '../../../types/mapperTypes';
import { CurveData, hasResponseData } from '../utils/resultsUtils';
import { pdfExport } from '../utils/exportUtils';

interface TreatmentCurvesProps {
  plate: Plate;
  curveData: CurveData[];
  yLo: number;
  yHi: number;
  protocol?: Protocol;
  showFitParams: boolean;
  gridSize: number;
}

const TreatmentCurves: React.FC<TreatmentCurvesProps> = ({
  plate,
  curveData,
  yLo,
  yHi,
  protocol,
  showFitParams,
  gridSize
}) => {
  const [curvesNode, setCurvesNode] = useState<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: 1100, height: 1100 })
  const [isExporting, setIsExporting] = useState(false);

  const curvesRef = useCallback((node: HTMLDivElement) => {
    if (node !== null) {
      setCurvesNode(node);
    }
  }, []);

  useEffect(() => {
    if (curvesNode) {
      const updateDimensions = () => {
        const rect = curvesNode.getBoundingClientRect();
        if (rect.height != 0 && rect.width != 0) {
          setDimensions({
            width: rect.width,
            height: rect.height
          });
        }
      };
      updateDimensions();
      const resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(curvesNode);
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [curvesNode])

  const exportToPDF = async () => {
    if (!curvesNode || curveData.length === 0) return;

    setIsExporting(true);

    try {
      // Find all parent elements that might be constraining the size
      const elementsToModify: Array<{ element: HTMLElement, originalStyles: { [key: string]: string } }> = [];

      let currentElement: HTMLElement | null = curvesNode;
      while (currentElement && currentElement !== document.body) {
        const computedStyle = window.getComputedStyle(currentElement);
        const originalStyles: { [key: string]: string } = {};

        // Store original styles that might constrain content
        if (computedStyle.overflow !== 'visible') {
          originalStyles.overflow = currentElement.style.overflow;
          currentElement.style.overflow = 'visible';
        }
        if (computedStyle.maxHeight !== 'none') {
          originalStyles.maxHeight = currentElement.style.maxHeight;
          currentElement.style.maxHeight = 'none';
        }
        if (computedStyle.height !== 'auto') {
          originalStyles.height = currentElement.style.height;
          currentElement.style.height = 'auto';
        }

        if (Object.keys(originalStyles).length > 0) {
          elementsToModify.push({ element: currentElement, originalStyles });
        }

        currentElement = currentElement.parentElement;
      }

      // Force a reflow to ensure all content is rendered
      curvesNode.offsetHeight;
      await new Promise(resolve => setTimeout(resolve, 200));

      // Capture the full container content
      const canvas = await html2canvas(curvesNode, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        width: curvesNode.scrollWidth,
        height: curvesNode.scrollHeight
      });

      const pdf = pdfExport(canvas, curvesNode, gridSize, {
        marginX: 0,
        marginY: 0,
        gapX: 0,
        gapY: 0,
        imageType: "JPEG",   // smaller PDFs; switch to "PNG" if you need lossless
      });


      // Restore all original styles
      elementsToModify.forEach(({ element, originalStyles }) => {
        Object.entries(originalStyles).forEach(([property, value]) => {
          if (value === '') {
            element.style.removeProperty(property);
          } else {
            (element.style as any)[property] = value;
          }
        });
      });

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const plateId = plate.barcode || `Plate_${plate.id}`;
      const filename = `${plateId}_dose_response_curves_${timestamp}.pdf`;

      pdf.save(filename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (curveData.length === 0) {
    return (
      <div className="text-center text-muted p-4">
        <p>No dose-response curves found.</p>
        <small>Curves require compounds with more than 4 concentration levels.</small>
        {protocol && protocol.dataProcessing.controls.length > 0 && (
          <div className="mt-2">
            <small>Control wells are excluded from dose-response analysis.</small>
          </div>
        )}
      </div>
    );
  }

  const curveWidth = (((dimensions.width - 8) - (gridSize * 8)) / gridSize) - 8;

  const treatmentCurves = curveData.map((curve) => (
    <CurveCard
      key={curve.treatmentId}
      treatmentKey={curve.treatmentId}
      yLo={yLo}
      yHi={yHi}
      curveData={curve}
      showFitParams={showFitParams ? 'true' : 'false'}
      curveWidth={curveWidth}
      gridSize={gridSize}
    />
  ));

  return (
    <Card className='overflow-auto'>
      <Card.Header className='d-flex justify-content-between align-items-center p-1'>
        <h5 className="mb-0">Dose-Response Curves</h5>
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted">
            {curveData.length} curve{curveData.length !== 1 ? 's' : ''} found
            {protocol && protocol.dataProcessing.controls.length > 0 && (" (controls excluded)")}
          </span>
          {curveData.length > 0 && (
            <Button
              size="sm"
              variant="outline-primary"
              onClick={exportToPDF}
              disabled={isExporting}
            >
              <Download size={14} className="me-1" />
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </Button>
          )}
        </div>
      </Card.Header>
      <Card.Body className='overflow-auto' ref={curvesRef}>
        {!plate || !hasResponseData(plate) ?
          <div>
            <h5>No plate data</h5>
            <p className='text-muted'>Please upload and parse plates to view response data</p>
          </div>
          :
          <Row md={gridSize} className="g-2">
            {treatmentCurves}
          </Row>}
      </Card.Body>
    </Card>
  );
};

export default TreatmentCurves;