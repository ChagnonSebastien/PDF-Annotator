import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { pdfjs, Document, Page } from 'react-pdf';
import { CgChevronLeft, CgChevronRight, CgPushChevronLeft, CgPushChevronRight } from 'react-icons/cg';
import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

interface Point { x: number, y: number };
interface Box { a: Point, b: Point };

interface Field { page: number, box: Box, id: string };

const size = (box: Box): number => {
  const width = Math.abs(box.a.x - box.b.x);
  const height = Math.abs(box.a.y - box.b.y);
  return width * height;
}

const tooSmall = (box: Box): boolean => size(box) < 200;

const mousePositionWithinContainer = (ev: MouseEvent, container: HTMLDivElement): Point | null => {
  const pageBoundingBox = container.getBoundingClientRect();
  const offsetX = ev.clientX - pageBoundingBox.left;
  const offsetY = ev.clientY - pageBoundingBox.top;
  return { x: offsetX, y: offsetY };
}

interface BoxProps {
  box: Box,
  selected?: boolean,
  onClick?: () => void,
  deleteSelf?: () => void,
}

const BoxElement = ({ box, onClick, selected, deleteSelf }: BoxProps): JSX.Element => (
  <>
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: Math.min(box.a.x, box.b.x),
        top: Math.min(box.a.y, box.b.y),
        width: Math.abs(box.a.x - box.b.x),
        height: Math.abs(box.a.y - box.b.y),
        backgroundColor: selected ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 255, 0, 0.5)',
        border: '2px solid black',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      {size(box) > 5000 ? 'Patient Signature' : 'PS'}
    </div>
    {selected && typeof deleteSelf !== 'undefined' ? (
      <div
        className="sb sb-left"
        style={{
          position: 'absolute',
          left: Math.min(box.a.x, box.b.x) + Math.abs(box.a.x - box.b.x) + 11,
          top: Math.min(box.a.y, box.b.y),
          cursor: 'pointer',
          zIndex: 100,
        }}
        onClick={deleteSelf}
      >
        Delete
      </div>
    ) : null}
  </>
);

BoxElement.defaultProps = {
  selected: false,
  onClick: undefined,
  deleteSelf: undefined,
};

const App = (): JSX.Element => {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);

  const [pageRef, setPageRef] = useState<HTMLDivElement | null>(null);

  const [firstPoint, setFirstPoint] = useState<Point | null>(null);
  const [secondPoint, setSecondPoint] = useState<Point | null>(null);

  const [fields, setFields] = useState<Array<Field & { selected: boolean }>>([]);
  const hasSelectedField = useMemo<boolean>(() => (
    typeof fields.find((field) => field.selected) !== 'undefined'
  ), [fields]);

  const commitNewZone = useCallback((ev: MouseEvent) => {
    if (secondPoint === null || firstPoint === null) return;
    
    if (!tooSmall({ a: firstPoint, b: secondPoint })) {
      setFields((prevFields) => [
        ...prevFields,
        {
          page: pageNumber,
          id: uuid(),
          box: { a: firstPoint, b: secondPoint },
          selected: false,
        },
      ]);
    } else if (hasSelectedField) {
      if (ev.target === null) return;
      if (!(ev.target as HTMLElement).classList.contains('sb')) {
        setFields((prevFields) => prevFields.map((prevField) => ({ ...prevField, selected: false })));
      }
    }
    setFirstPoint(null);
    setSecondPoint(null);
  }, [firstPoint, secondPoint, pageNumber, hasSelectedField]);

  useEffect(() => {
    if (pageRef === null) return;

    const mouseDownListener = (ev: MouseEvent) => {
      if (ev.target === null || firstPoint !== null) return;
      const mousePosition = mousePositionWithinContainer(ev, pageRef);
      setFirstPoint(mousePosition);
      ev.preventDefault();
    }

    const mouseMoveListener = (ev: MouseEvent) => {
      if (ev.target === null) return;
      const mousePosition = mousePositionWithinContainer(ev, pageRef);
      setSecondPoint(mousePosition);

      if (firstPoint && hasSelectedField) {
        setFields((prevFields) => prevFields.map((prevField) => ({ ...prevField, selected: false })));
      }
    }

    pageRef.addEventListener('mousedown', mouseDownListener);
    pageRef.addEventListener('mousemove', mouseMoveListener);
    pageRef.addEventListener('mouseup', commitNewZone);
    return () => {
      pageRef.removeEventListener('mousedown', mouseDownListener);
      pageRef.removeEventListener('mousemove', mouseMoveListener);
      pageRef.removeEventListener('mouseup', commitNewZone);
    };
  }, [pageRef, commitNewZone, firstPoint, hasSelectedField]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#EEE'
      }}
    >
      <Document
        className="absolute_f"
        file="OoPdfFormExample.pdf"
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
        }}
        loading="Loading conscent form..."
      >
        <Page
          pageNumber={pageNumber}
          inputRef={setPageRef}
        >
          {
            firstPoint !== null && secondPoint !== null && !tooSmall({ a: firstPoint, b: secondPoint })
              ? <BoxElement box={{ a: firstPoint, b: secondPoint }} />
              : null
          }
          {
            fields
              .filter((field) => field.page === pageNumber)
              .map((field) => (
                <BoxElement
                  key={field.id}
                  box={field.box}
                  selected={field.selected}
                  onClick={() => setFields((prevFields) => prevFields.map((prevField) => ({
                    ...prevField,
                    selected: prevField.id === field.id,
                  })))}
                  deleteSelf={() => setFields((prevFields) => (
                    prevFields.filter((prevField) => prevField.id !== field.id)
                  ))}
                />
              ))
          }
        </Page>
      </Document>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <CgPushChevronLeft
          color="gray"
          style={{ cursor: 'pointer' }}
          onClick={() => setPageNumber(1)}
        />
        <CgChevronLeft
          color="gray"
          style={{ cursor: 'pointer' }}
          onClick={() => setPageNumber((prev) => prev === 1 ? 1 : prev - 1)}
        />
        <p style={{ margin: '1rem' }}>
          Page {pageNumber} of {numPages}
        </p>
        <CgChevronRight
          color="gray"
          style={{ cursor: 'pointer' }}
          onClick={() => setPageNumber((prev) => prev === numPages ? prev : prev + 1)}
        />
        <CgPushChevronRight
          color="gray"
          style={{ cursor: 'pointer' }}
          onClick={() => setPageNumber(pageNumber)}
        />
      </div>
    </div>
  );
}

export default App;
