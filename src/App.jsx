import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, Transformer } from 'react-konva';

/**
 * 輔助小元件 / Helper Component:
 * 多邊形的「頂點控制點 (Anchor)」，可拖曳來更新多邊形頂點
 * (Control point for polygon vertices, draggable to update the polygon's vertex position)
 */
function Anchor({ x, y, onDragMove, index }) {
  return (
    <Circle
      x={x}
      y={y}
      radius={6}
      fill="#fff"
      stroke="#000"
      strokeWidth={1}
      draggable
      onDragMove={(e) => {
        const newX = e.target.x();
        const newY = e.target.y();
        onDragMove(index, newX, newY);
      }}
      // 避免拖動 anchor 時還觸發父層的 click，故要阻止事件冒泡
      // (Prevent event bubbling to avoid triggering parent click events during drag)
      onMouseDown={(e) => e.cancelBubble = true}
      onTouchStart={(e) => e.cancelBubble = true}
    />
  );
}

/**
 * 多邊形 Polygon 元件 / Polygon Component:
 * 可點擊選取，若被選取就顯示頂點控制點
 * (Clickable polygon that displays vertex anchors when selected)
 */
function PolygonWithAnchors({ shape, isSelected, onSelect, onChange }) {
  // shape.data.points 格式：[x1, y1, x2, y2, ...]
  // (Points array format: [x1, y1, x2, y2, ...])
  const { points } = shape.data;
  const lineRef = useRef(null);

  // 拖曳整個多邊形時，需同步更新所有頂點座標
  // (When dragging the entire polygon, update all vertex coordinates accordingly)
  const handleDragMove = (e) => {
    const dx = e.target.x() - (lineRef.current.x() || 0);
    const dy = e.target.y() - (lineRef.current.y() || 0);

    const newPoints = [];
    for (let i = 0; i < points.length; i += 2) {
      newPoints.push(points[i] + dx, points[i + 1] + dy);
    }

    onChange({
      ...shape,
      data: {
        ...shape.data,
        points: newPoints
      }
    });

    // 重設 Line 自己的 x, y 回到 0,0 (把平移量轉換到 points)
    // (Reset the line's x, y to 0 so that the translation is applied to the points)
    lineRef.current.x(0);
    lineRef.current.y(0);
  };

  // 拖曳頂點事件：更新指定頂點的座標
  // (Event handler for dragging a vertex: update the specified vertex coordinates)
  const handleAnchorDragMove = (index, newX, newY) => {
    const newPoints = [...points];
    newPoints[index * 2] = newX;
    newPoints[index * 2 + 1] = newY;

    onChange({
      ...shape,
      data: {
        ...shape.data,
        points: newPoints
      }
    });
  };

  // 組合 anchors：若被選取則顯示所有控制點
  // (Render anchors: display all control points if the polygon is selected)
  const anchors = [];
  if (isSelected) {
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];
      anchors.push(
        <Anchor
          key={i}
          index={i / 2}
          x={x}
          y={y}
          onDragMove={handleAnchorDragMove}
        />
      );
    }
  }

  return (
    <>
      <Line
        ref={lineRef}
        points={points}
        fill="rgba(0,255,0,0.2)"
        stroke="green"
        strokeWidth={2}
        closed
        // 允許整個多邊形被拖曳
        // (Allow the entire polygon to be draggable)
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragMove}
        // 避免拖曳過程中 points 被覆蓋，拖曳開始前先重設
        // (Reset position to 0 at drag start to prevent points from being overwritten)
        onDragStart={(e) => {
          e.target.x(0);
          e.target.y(0);
        }}
      />
      {/* 若被選取，顯示頂點控制點 / Show vertex anchors when selected */}
      {anchors}
    </>
  );
}

/**
 * Rect / Circle 的容器元件 / Container Component for Rect/Circle:
 * 可使用 Konva.Transformer 進行調整
 * (Supports transformation using Konva.Transformer)
 */
function ShapeWithTransformer({ shape, isSelected, onSelect, onChange, transformerRef }) {
  const shapeRef = useRef(null);

  useEffect(() => {
    // 若當前 shape 被選取，將 transformer 綁定到對應的 Konva.Node
    // (If the shape is selected, attach the transformer to the corresponding Konva node)
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [isSelected, transformerRef]);

  // 當使用 Transformer 進行縮放/旋轉/拖曳後，更新 shape 狀態
  // (After transformation (scale/rotate/drag) ends, update the shape state)
  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    // 取得變形後的資料
    // (Retrieve the transformed properties)
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = node.rotation();
    const x = node.x();
    const y = node.y();

    if (shape.type === 'rect') {
      // 對於矩形，寬高根據 scale 進行調整
      // (For rectangle, compute width and height using scale factors)
      const width = node.width() * scaleX;
      const height = node.height() * scaleY;

      onChange({
        ...shape,
        data: {
          x1: x,
          y1: y,
          width,
          height
        }
      });
    } else if (shape.type === 'circle') {
      // 對於圓形，取 scale 平均值作為新的半徑
      // (For circle, compute new radius by averaging the scale factors)
      const r = node.radius() * (scaleX + scaleY) / 2;
      onChange({
        ...shape,
        data: {
          cx: x,
          cy: y,
          r
        }
      });
    }

    // 重置變形狀態 (scale 與 rotation)，以免後續累加
    // (Reset scale and rotation to avoid accumulation in future transformations)
    node.scaleX(1);
    node.scaleY(1);
    node.rotation(rotation);
  };

  // 拖曳結束後更新位置座標 (x1, y1 或 cx, cy)
  // (After drag end, update the position coordinates accordingly)
  const handleDragEnd = (e) => {
    const node = e.target;
    if (!node) return;

    if (shape.type === 'rect') {
      onChange({
        ...shape,
        data: {
          ...shape.data,
          x1: node.x(),
          y1: node.y(),
        }
      });
    } else if (shape.type === 'circle') {
      onChange({
        ...shape,
        data: {
          ...shape.data,
          cx: node.x(),
          cy: node.y()
        }
      });
    }
  };

  if (shape.type === 'rect') {
    const { x1, y1, width, height } = shape.data;
    return (
      <Rect
        ref={shapeRef}
        x={x1}
        y={y1}
        width={width}
        height={height}
        fill="rgba(255,0,0,0.2)"
        stroke="red"
        strokeWidth={2}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onTransformEnd={handleTransformEnd}
        onDragEnd={handleDragEnd}
      />
    );
  } else if (shape.type === 'circle') {
    const { cx, cy, r } = shape.data;
    return (
      <Circle
        ref={shapeRef}
        x={cx}
        y={cy}
        radius={r}
        fill="rgba(0,0,blue,0.2)"
        stroke="blue"
        strokeWidth={2}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onTransformEnd={handleTransformEnd}
        onDragEnd={handleDragEnd}
      />
    );
  }
  return null;
}

/**
 * 主 App / Main App Component:
 * 本應用程式使用 react-konva 實作圖片標註，支援矩形、圓形與多邊形繪製與編輯
 * (This application is an image annotation tool using react-konva that supports drawing and editing of rectangles, circles, and polygons)
 */
export default function App() {
  // ------------------------------
  // State / Refs 狀態與引用
  // ------------------------------
  const [imageUrl, setImageUrl] = useState('');
  const [konvaImage, setKonvaImage] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  const [shapes, setShapes] = useState([]); // 所有繪製形狀 / All drawn shapes
  const [selectedId, setSelectedId] = useState(null); // 當前選取的 shape ID / Currently selected shape ID

  const [shapeType, setShapeType] = useState('rect'); // 繪製形狀類型：rect | circle | poly
  const [isDrawing, setIsDrawing] = useState(false); // 是否正在拖曳繪製 rect/circle / Flag for drawing rect or circle
  const [drawingShape, setDrawingShape] = useState(null); // 暫存繪製中的 rect/circle / Temporary shape being drawn

  // 多邊形建立中相關狀態 / Polygon drawing state
  const [isCreatingPoly, setIsCreatingPoly] = useState(false);
  const [tempPolyPoints, setTempPolyPoints] = useState([]); // 暫存多邊形頂點 / Temporary polygon points

  // 匯出結果狀態 (顯示在 <textarea>) / Exported SQL statements
  const [exportSQL, setExportSQL] = useState('');

  // Stage 與 Transformer 的引用 / Refs for Stage and Transformer
  const stageRef = useRef(null);
  const transformerRef = useRef(null);

  // ------------------------------
  // 載入圖片 / Image Loading
  // ------------------------------
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
  };

  const handleUrlChange = (e) => {
    setImageUrl(e.target.value);
  };

  // 圖片載入完後，調整 Stage 尺寸並存取 konvaImage
  // (After image load, adjust stage size and set the konvaImage)
  useEffect(() => {
    if (!imageUrl) {
      setKonvaImage(null);
      return;
    }
    const img = new Image();
    img.src = imageUrl;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setKonvaImage(img);
      setStageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
  }, [imageUrl]);

  // ------------------------------
  // 滑鼠事件 - rect/circle 繪製 (拖曳繪製) / Mouse Events for Rect/Circle Drawing (Drag-to-draw)
  // ------------------------------
  const handleMouseDown = () => {
    if (!konvaImage) return;

    // 若目前為多邊形模式且正在建立多邊形
    // (If in polygon mode, add vertices on each click)
    if (shapeType === 'poly') {
      if (!isCreatingPoly) {
        setIsCreatingPoly(true);
        setTempPolyPoints([]);
      }
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (pointer) {
        setTempPolyPoints((prev) => [...prev, pointer.x, pointer.y]);
      }
      return;
    }

    // 否則為 rect / circle 模式
    // (Otherwise, for rectangle or circle drawing)
    setIsDrawing(true);
    const stage = stageRef.current;
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    // 取消之前的選取 / Deselect any previously selected shape
    setSelectedId(null);

    if (shapeType === 'rect') {
      setDrawingShape({
        id: Date.now(),
        name: '矩形', // "Rectangle"
        type: 'rect',
        data: {
          x1: pointerPos.x,
          y1: pointerPos.y,
          x2: pointerPos.x, // 暫存終點 / Temporary end point
          y2: pointerPos.y  // 暫存終點 / Temporary end point
        }
      });
    } else if (shapeType === 'circle') {
      setDrawingShape({
        id: Date.now(),
        name: '圓形', // "Circle"
        type: 'circle',
        data: {
          cx: pointerPos.x,
          cy: pointerPos.y,
          r: 0
        }
      });
    }
  };

  const handleMouseMove = () => {
    if (!isDrawing || !drawingShape) return;

    const stage = stageRef.current;
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    if (drawingShape.type === 'rect') {
      setDrawingShape((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          x2: pointerPos.x,
          y2: pointerPos.y
        }
      }));
    } else if (drawingShape.type === 'circle') {
      const { cx, cy } = drawingShape.data;
      const dx = pointerPos.x - cx;
      const dy = pointerPos.y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      setDrawingShape((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          r
        }
      }));
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (drawingShape) {
      if (drawingShape.type === 'rect') {
        // 將 (x1, y1, x2, y2) 轉換為 (x1, y1, width, height)
        // (Convert (x1, y1, x2, y2) to (x1, y1, width, height))
        const { x1, y1, x2, y2 } = drawingShape.data;
        const rx1 = Math.min(x1, x2);
        const ry1 = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        const newRect = {
          ...drawingShape,
          data: {
            x1: rx1,
            y1: ry1,
            width,
            height
          }
        };
        setShapes((prev) => [...prev, newRect]);
      } else if (drawingShape.type === 'circle') {
        // 對於圓形，直接使用 cx, cy, r
        // (For circle, use cx, cy, r directly)
        setShapes((prev) => [...prev, drawingShape]);
      }
      setDrawingShape(null);
    }
  };

  // ------------------------------
  // 多邊形 - 結束建立 (雙擊或按 Esc) / Finish Polygon (Double-click or press Esc)
  // ------------------------------
  const handleDoubleClick = () => {
    if (shapeType === 'poly' && isCreatingPoly) {
      finishPoly();
    }
  };

  // 結束多邊形建立並儲存已完成的多邊形
  // (Finish polygon drawing and save the completed polygon)
  const finishPoly = useCallback(() => {
    if (tempPolyPoints.length >= 4) {
      const newPoly = {
        id: Date.now(),
        name: '多邊形', // "Polygon"
        type: 'poly',
        data: {
          points: tempPolyPoints
        }
      };
      setShapes((prev) => [...prev, newPoly]);
    }
    // 重置多邊形建立狀態 / Reset polygon drawing state
    setIsCreatingPoly(false);
    setTempPolyPoints([]);
  }, [tempPolyPoints]);

  // 監聽鍵盤事件：Esc 結束多邊形，Backspace/Delete 刪除選取形狀
  // (Keyboard events: Esc to finish polygon, Backspace/Delete to remove selected shape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isCreatingPoly) {
        finishPoly();
      }
      const ignoreTags = ['INPUT', 'TEXTAREA', 'SELECT'];
      if (ignoreTags.includes(e.target.tagName)) {
        return;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId !== null) {
        e.preventDefault();
        handleDeleteShape(selectedId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, isCreatingPoly, finishPoly]);

  // ------------------------------
  // 形狀選取與更新 / Shape Selection & Update
  // ------------------------------
  const handleSelectShape = (id) => {
    setSelectedId(id);
  };

  const handleShapeChange = (updatedShape) => {
    setShapes((prev) => {
      const idx = prev.findIndex((s) => s.id === updatedShape.id);
      if (idx === -1) return prev;
      const newArr = [...prev];
      newArr[idx] = updatedShape;
      return newArr;
    });
  };

  // ------------------------------
  // 刪除形狀 / Delete Shape
  // ------------------------------
  const handleDeleteShape = (id) => {
    setShapes((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  // ------------------------------
  // 修改「name」欄位 / Update Shape Name
  // ------------------------------
  const handleNameChange = (id, newName) => {
    setShapes((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const newArr = [...prev];
      newArr[idx] = { ...newArr[idx], name: newName };
      return newArr;
    });
  };

  // ------------------------------
  // 修改「booth_no」欄位 / Update Booth Number
  // ------------------------------
  const handleBoothNoChange = (id, newName) => {
    setShapes((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const newArr = [...prev];
      newArr[idx] = { ...newArr[idx], booth_no: newName };
      return newArr;
    });
  };

  // ------------------------------
  // 將 shape 轉換成整數座標格式 / Convert Shape to Integer Coordinates
  // ------------------------------
  const getShapeCoordinates = (shape) => {
    const { type, data } = shape;
    if (type === 'rect') {
      const x1 = Math.round(data.x1);
      const y1 = Math.round(data.y1);
      const x2 = x1 + Math.round(data.width);
      const y2 = y1 + Math.round(data.height);
      return JSON.stringify({ x1, y1, x2, y2 });
    } else if (type === 'circle') {
      const cx = Math.round(data.cx);
      const cy = Math.round(data.cy);
      const r = Math.round(data.r);
      return JSON.stringify({ cx, cy, r });
    } else if (type === 'poly') {
      const arr = [];
      const pts = data.points;
      for (let i = 0; i < pts.length; i += 2) {
        arr.push({
          x: Math.round(pts[i]),
          y: Math.round(pts[i + 1])
        });
      }
      return JSON.stringify(arr);
    }
    return '';
  };

  /**
   * 匯出按鈕：將所有 shapes 轉為 SQL INSERT 語句
   * (Export button: convert all shapes into SQL INSERT statements)
   */
  const handleExport = () => {
    let lines = '';
    shapes.forEach((shape) => {
      const shapeType = shape.type;
      const coordsStr = getShapeCoordinates(shape);
      // 組合 SQL 語句範例
      // (Example: INSERT INTO exhibits (map_id, name, booth_no, shape_type, coordinates) VALUES (...))
      const line1 = `INSERT INTO exhibits ( map_id, name, booth_no, shape_type, coordinates) VALUES (17,'${shape.name}','${shape.booth_no}','${shapeType}', '${coordsStr}');`;
      lines += line1 + '\n';
      const line2 = `INSERT INTO exhibits ( map_id, name, booth_no, shape_type, coordinates) VALUES (18,'${shape.name}','${shape.booth_no}','${shapeType}', '${coordsStr}');`;
      lines += line2 + '\n';
    });
    setExportSQL(lines.trim());
  };

  // ------------------------------
  // 繪製已完成形狀 / Render Completed Shapes
  // ------------------------------
  const renderShapes = () => {
    return shapes.map((shape) => {
      if (shape.type === 'poly') {
        return (
          <PolygonWithAnchors
            key={shape.id}
            shape={shape}
            isSelected={selectedId === shape.id}
            onSelect={() => handleSelectShape(shape.id)}
            onChange={handleShapeChange}
          />
        );
      } else {
        return (
          <ShapeWithTransformer
            key={shape.id}
            shape={shape}
            isSelected={selectedId === shape.id}
            onSelect={() => handleSelectShape(shape.id)}
            onChange={handleShapeChange}
            transformerRef={transformerRef}
          />
        );
      }
    });
  };

  // 繪製「暫存」多邊形 / Render Temporary Polygon (in progress)
  const renderTempPoly = () => {
    if (shapeType !== 'poly' || !isCreatingPoly || tempPolyPoints.length < 2) return null;
    return (
      <Line
        points={tempPolyPoints}
        stroke="orange"
        strokeWidth={2}
        fill="rgba(255,165,0,0.3)"
        closed={false}
      />
    );
  };

  // 矩形/圓形繪製中預覽 / Render Preview of Rectangle/Circle Being Drawn
  const renderDrawingShape = () => {
    if (!drawingShape) return null;
    if (drawingShape.type === 'rect') {
      const { x1, y1, x2, y2 } = drawingShape.data;
      const rx1 = Math.min(x1, x2);
      const ry1 = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      return (
        <Rect
          x={rx1}
          y={ry1}
          width={width}
          height={height}
          stroke="green"
          dash={[4, 4]}
          strokeWidth={2}
        />
      );
    } else if (drawingShape.type === 'circle') {
      const { cx, cy, r } = drawingShape.data;
      return (
        <Circle
          x={cx}
          y={cy}
          radius={r}
          stroke="green"
          dash={[4, 4]}
          strokeWidth={2}
        />
      );
    }
    return null;
  };

  // ------------------------------
  // Render 畫面 / Render UI
  // ------------------------------
  return (
    <div style={{ display: 'flex', padding: 20 }}>
      {/* 左側：工具區 / Left Panel: Tools */}
      <div style={{ width: '600px', marginRight: '20px', zIndex: 400 }}>
        <h3>上傳圖片 / Upload Image</h3>
        <input type="file" onChange={handleFileChange} />

        <h4>或輸入遠端圖片 URL / Or enter remote image URL</h4>
        <input
          type="text"
          placeholder="https://example.com/image.jpg"
          value={imageUrl}
          onChange={handleUrlChange}
          style={{ width: '100%', marginBottom: 8 }}
        />

        <h3>選擇形狀 / Select Shape</h3>
        <select
          value={shapeType}
          onChange={(e) => {
            setShapeType(e.target.value);
            // 若切換到其他形狀，確保結束多邊形模式
            // (If switching shape type, finish polygon mode)
            if (e.target.value !== 'poly') {
              finishPoly();
            }
          }}
          style={{ width: '100%', marginBottom: 8 }}
        >
          <option value="rect">矩形 (Rectangle)</option>
          <option value="circle">圓形 (Circle)</option>
          <option value="poly">多邊形 (Polygon)</option>
        </select>

        <p style={{ fontSize: '12px', color: '#999' }}>
          ＊按下滑鼠拖曳繪製矩形／圓形；多邊形則連續點擊加入頂點，雙擊或 Esc 結束。
          <br />
          ＊點擊圖形可編輯；按 Backspace/Delete 可刪除選取。
          <br />
          * Drag to draw rectangle/circle; in polygon mode, click to add vertices, double-click or press Esc to finish.
          <br />
          * Click on a shape to edit; press Backspace/Delete to remove the selected shape.
        </p>

        <div style={{ overflow: 'scroll', height: '1000px' }}>
          {/* 表格：名稱、Booth、類型、座標、刪除按鈕 / Table: Name, Booth, Type, Coordinates, Delete */}
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Name (可編輯)</th>
                <th style={{ width: '15%' }}>Booth (可編輯)</th>
                <th style={{ width: '15%' }}>Type</th>
                <th>Coordinates</th>
                <th style={{ width: '10%' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {shapes.map((shape) => {
                const coordStr = getShapeCoordinates(shape);
                return (
                  <tr key={shape.id}>
                    <td>
                      <input
                        type="text"
                        value={shape.name}
                        style={{ width: '100%' }}
                        onChange={(e) => handleNameChange(shape.id, e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={shape.booth_no}
                        style={{ width: '100%' }}
                        onChange={(e) => handleBoothNoChange(shape.id, e.target.value)}
                      />
                    </td>
                    <td>{shape.type}</td>
                    <td>{coordStr}</td>
                    <td>
                      <button onClick={() => handleDeleteShape(shape.id)}>刪除 / Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* 匯出按鈕 & 結果 / Export Button & Output */}
          <div style={{ marginTop: 16 }}>
            <button onClick={handleExport}>輸出 INSERT 語句 / Export SQL</button>
            {exportSQL && (
              <div style={{ marginTop: 8 }}>
                <textarea
                  style={{ width: '100%', height: '200px' }}
                  readOnly
                  value={exportSQL}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右側：繪圖區 / Right Panel: Drawing Area */}
      <div>
        <div>
          <div
            style={{
              border: '1px solid #ccc',
              width: stageSize.width,
              height: stageSize.height,
              position: 'relative',
              marginBottom: 20
            }}
          >
            <Stage
              ref={stageRef}
              width={stageSize.width}
              height={stageSize.height}
              onMouseDown={handleMouseDown}
              onMousemove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onDblClick={handleDoubleClick}
              style={{ background: '#eee' }}
            >
              <Layer>
                {/* 顯示圖片 / Display Image */}
                {konvaImage && (
                  <KonvaImage
                    image={konvaImage}
                    x={0}
                    y={0}
                  />
                )}

                {/* 已完成的形狀 / Render Completed Shapes */}
                {renderShapes()}

                {/* Transformer for Rect/Circle (全域) / Global Transformer for Rect/Circle */}
                <Transformer
                  ref={transformerRef}
                  rotateEnabled={true}
                  enabledAnchors={[
                    'top-left',
                    'top-right',
                    'bottom-left',
                    'bottom-right',
                    'middle-left',
                    'middle-right',
                    'top-center',
                    'bottom-center'
                  ]}
                />

                {/* 多邊形繪製中 (暫存線) / Temporary line for polygon drawing */}
                {renderTempPoly()}

                {/* 矩形/圓形繪製中預覽 / Preview for rectangle/circle being drawn */}
                {renderDrawingShape()}
              </Layer>
            </Stage>
          </div>
        </div>
      </div>
    </div>
  );
}
