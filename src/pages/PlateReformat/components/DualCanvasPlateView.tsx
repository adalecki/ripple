import React from "react";
import { Row, Col, Container } from "react-bootstrap";
import PlateViewCanvas from "../../../components/PlateViewCanvas";
import { Plate } from "../../../classes/PlateClass";
import { buildWellTransferMap, formatWellBlock, getCoordsFromWellId, getWellIdFromCoords, numberToLetters, type TransferBlock } from "../../../utils/plateUtils";
import { getPlateColorAndBorders } from "../utils/reformatUtils";
import { selectorHelper } from "../../../utils/designUtils";

interface DualPlateViewProps {
  plateBarcodeCache: Map<number,string>
  sourcePlate: Plate;
  destPlate: Plate;
  selectedSrcWells: string[];
  setSelectedSrcWells: React.Dispatch<React.SetStateAction<string[]>>;
  selectedDstWells: string[];
  setSelectedDstWells: React.Dispatch<React.SetStateAction<string[]>>;
  selectionRef: React.RefObject<HTMLDivElement | null>;
  sourceLabel?: string;
  destLabel?: string;
  transferBlocks?: TransferBlock[];
}

const DualCanvasPlateView: React.FC<DualPlateViewProps> = ({
  plateBarcodeCache,
  sourcePlate,
  destPlate,
  selectedSrcWells,
  setSelectedSrcWells,
  selectedDstWells,
  setSelectedDstWells,
  selectionRef,
  sourceLabel = "Source Plate",
  destLabel = "Destination Plate",
  transferBlocks = []
}) => {


  const handleLabelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const targetLabel = target.innerText;

    const parentPlate = target.closest("[data-view]");
    if (!parentPlate) return;

    const selectorQuery = parentPlate.getAttribute("data-view")?.split("-")[1];
    if (!selectorQuery) return;

    const plate = selectorQuery === "source" ? sourcePlate : destPlate;
    const selected = selectorQuery === "source" ? selectedSrcWells : selectedDstWells;
    const setSelected = selectorQuery === "source" ? setSelectedSrcWells : setSelectedDstWells;

    const newSelected: string[] = [];

    if (target.className.includes("all-wells-container")) {
      for (let r = 0; r < plate.rows; r++) {
        for (let c = 0; c < plate.columns; c++) {
          newSelected.push(getWellIdFromCoords(r, c));
        }
      }

      if (newSelected.length === selected.length) newSelected.length = 0;
      setSelected(newSelected);
      return;
    }

    for (let r = 0; r < plate.rows; r++) {
      for (let c = 0; c < plate.columns; c++) {
        const wellId = getWellIdFromCoords(r, c);
        const coords = getCoordsFromWellId(wellId);

        const shouldSelect = isNaN(parseInt(targetLabel))
          ? numberToLetters(coords.row) === targetLabel
          : (coords.col + 1).toString() === targetLabel;

        if (shouldSelect) newSelected.push(wellId);
      }
    }
    selectorHelper(e, newSelected, selected, setSelected)
  };

  const { colorConfig: sourceColorConfig, borderMap: sourceBorderMap } = getPlateColorAndBorders(sourcePlate, transferBlocks, "source");
  const sourceTransferMap = buildWellTransferMap(sourcePlate,transferBlocks,'source', plateBarcodeCache)
  const { colorConfig: destColorConfig, borderMap: destBorderMap } = getPlateColorAndBorders(destPlate, transferBlocks, "destination");
  const destTransferMap = buildWellTransferMap(destPlate,transferBlocks,'destination', plateBarcodeCache)

  return (
    <Container fluid>
      <Row>
        <Col md={6}>
          <h5 className="text-center mb-3">
            {sourceLabel} {sourcePlate && ` (${sourcePlate.barcode || "No Barcode"})`}
          </h5>

          <PlateViewCanvas
            plate={sourcePlate}
            view="reformat-source"
            colorConfig={sourceColorConfig}
            selectedWells={selectedSrcWells}
            handleLabelClick={handleLabelClick}
            blockBorderMap={sourceBorderMap}
            transferMap={sourceTransferMap}
          />


          {selectedSrcWells.length > 0 && (
            <div className="text-center text-muted small mb-2">
              Selected: {formatWellBlock(selectedSrcWells)}
            </div>
          )}
        </Col>
        <Col md={6}>

          <h5 className="text-center mb-3">
            {destLabel} {destPlate && ` (${destPlate.barcode || "No Barcode"})`}
          </h5>

          <PlateViewCanvas
            plate={destPlate}
            view="reformat-destination"
            colorConfig={destColorConfig}
            selectedWells={selectedDstWells}
            handleLabelClick={handleLabelClick}
            blockBorderMap={destBorderMap}
            transferMap={destTransferMap}
          />

          {selectedDstWells.length > 0 && (
            <div className="text-center text-muted small mb-2">
              Selected: {formatWellBlock(selectedDstWells)}
            </div>
          )}
        </Col>
      </Row>
      <div ref={selectionRef} style={{ position: "absolute", pointerEvents: "none", display: "none" }} />
    </Container>

  );
};

export default DualCanvasPlateView;
