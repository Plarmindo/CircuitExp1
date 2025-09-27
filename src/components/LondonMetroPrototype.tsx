/**
 * Enhanced London Metro Map Style Prototype
 *
 * This component visualizes folder structures as a London Underground map
 * with zoom controls and dynamic detail levels like Google Maps.
 * Features 10+ stations per line with geographic diversity.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';

export interface MetroNode {
  id: string;
  name: string;
  type: 'main' | 'subfolder' | 'file';
  path: string;
  x: number;
  y: number;
  lineColor: string;
  lineName: string;
  size: number;
  visible: boolean;
  detailLevel: number; // 1=overview, 2=medium, 3=detailed
  opacity?: number; // For smooth transitions
}

export interface MetroLine {
  id: string;
  name: string;
  color: string;
  points: { x: number; y: number }[];
}

interface LondonMetroPrototypeProps {
  width?: number;
  height?: number;
  rootPath?: string;
  onNodeClick?: (node: MetroNode) => void;
  onNodeHover?: (node: MetroNode | null) => void;
}

const LondonMetroPrototype: React.FC<LondonMetroPrototypeProps> = ({
  width = 1000,
  height = 600,
  rootPath = '/root',
  onNodeClick,
  onNodeHover,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const containerRef = useRef<PIXI.Container | null>(null);
  const [selectedNode, setSelectedNode] = useState<MetroNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MetroNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.5); // 1=overview, 1.5=standard (optimal), 2=medium, 3=detailed
  const [_targetZoomLevel, _setTargetZoomLevel] = useState<number>(1.5);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // London Underground color scheme with additional lines
  const londonLines = {
    central: { name: 'Central', color: '#DC241F' },
    piccadilly: { name: 'Piccadilly', color: '#0019A8' },
    district: { name: 'District', color: '#007229' },
    circle: { name: 'Circle', color: '#FFD329' },
    metropolitan: { name: 'Metropolitan', color: '#9B0058' },
    northern: { name: 'Northern', color: '#000000' },
    jubilee: { name: 'Jubilee', color: '#868F98' },
    victoria: { name: 'Victoria', color: '#0098D8' },
    elizabeth: { name: 'Elizabeth', color: '#6950A1' },
    hammersmith: { name: 'Hammersmith & City', color: '#F491A8' },
  };

  // Generate comprehensive station data with geographic diversity
  const generateStationData = useCallback((): { nodes: MetroNode[]; lines: MetroLine[] } => {
    const centerX = width / 2;
    const centerY = height / 2;
    const nodes: MetroNode[] = [];
    const lines: MetroLine[] = [];

    // Main central station (interchange)
    nodes.push({
      id: 'main-station',
      name: 'King\'s Cross St. Pancras',
      type: 'main',
      path: rootPath,
      x: centerX,
      y: centerY,
      lineColor: '#FFFFFF',
      lineName: 'Interchange',
      size: 20,
      visible: true,
      detailLevel: 1,
    });

    // Define line configurations with geographic spread
    const lineConfigs = [
      {
        line: londonLines.central,
        direction: 0, // East-West
        stations: [
          'Liverpool Street', 'Bank', 'St. Paul\'s', 'Chancery Lane', 'Holborn',
          'Tottenham Court Road', 'Oxford Circus', 'Bond Street', 'Marble Arch',
          'Lancaster Gate', 'Queensway', 'Notting Hill Gate'
        ]
      },
      {
        line: londonLines.piccadilly,
        direction: 45, // Northeast-Southwest
        stations: [
          'Heathrow Terminal 5', 'Heathrow Terminals 2 & 3', 'Hatton Cross', 'Hounslow West',
          'Osterley', 'Boston Manor', 'Northfields', 'South Ealing', 'Acton Town',
          'Hammersmith', 'Barons Court', 'Earl\'s Court'
        ]
      },
      {
        line: londonLines.district,
        direction: 90, // North-South
        stations: [
          'Upminster', 'Upminster Bridge', 'Hornchurch', 'Elm Park', 'Dagenham East',
          'Dagenham Heathway', 'Becontree', 'Upney', 'Barking', 'East Ham',
          'Upton Park', 'Plaistow'
        ]
      },
      {
        line: londonLines.circle,
        direction: 135, // Northwest-Southeast
        stations: [
          'Edgware Road', 'Paddington', 'Bayswater', 'Notting Hill Gate', 'High Street Kensington',
          'Gloucester Road', 'South Kensington', 'Sloane Square', 'Victoria', 'St. James\'s Park',
          'Westminster', 'Embankment'
        ]
      },
      {
        line: londonLines.metropolitan,
        direction: 180, // South-North
        stations: [
          'Aldgate', 'Liverpool Street', 'Moorgate', 'Barbican', 'Farringdon',
          'Great Portland Street', 'Baker Street', 'Finchley Road', 'Wembley Park',
          'Harrow-on-the-Hill', 'Northwood', 'Rickmansworth'
        ]
      },
      {
        line: londonLines.northern,
        direction: 225, // Southwest-Northeast
        stations: [
          'Morden', 'South Wimbledon', 'Colliers Wood', 'Tooting Broadway', 'Tooting Bec',
          'Balham', 'Clapham South', 'Clapham Common', 'Clapham North', 'Stockwell',
          'Oval', 'Kennington'
        ]
      },
      {
        line: londonLines.jubilee,
        direction: 270, // West-East
        stations: [
          'Stanmore', 'Canons Park', 'Queensbury', 'Kingsbury', 'Wembley Park',
          'Neasden', 'Dollis Hill', 'Willesden Green', 'Kilburn', 'West Hampstead',
          'Finchley Road', 'Swiss Cottage'
        ]
      },
      {
        line: londonLines.victoria,
        direction: 315, // Southeast-Northwest
        stations: [
          'Brixton', 'Stockwell', 'Vauxhall', 'Pimlico', 'Victoria', 'Green Park',
          'Oxford Circus', 'Warren Street', 'Euston', 'King\'s Cross St. Pancras',
          'Highbury & Islington', 'Finsbury Park'
        ]
      }
    ];

    // Generate stations for each line
    lineConfigs.forEach((config, _lineIndex) => {
      const { line, direction, stations } = config;
      const linePoints: { x: number; y: number }[] = [{ x: centerX, y: centerY }];

      stations.forEach((stationName, index) => {
        const distance = 80 + (index * 40); // Increasing distance from center
        const angle = (direction * Math.PI) / 180;
        const spread = (index % 2 === 0 ? 1 : -1) * (index * 0.1); // Add some curve

        const x = centerX + Math.cos(angle + spread) * distance;
        const y = centerY + Math.sin(angle + spread) * distance;

        // Determine detail level based on distance from center
        let detailLevel = 1;
        if (distance < 120) detailLevel = 1; // Always visible
        else if (distance < 200) detailLevel = 2; // Medium zoom
        else detailLevel = 3; // High zoom only

        const node: MetroNode = {
          id: `${line.name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
          name: stationName,
          type: index < 6 ? 'subfolder' : 'file',
          path: `${rootPath}/${line.name}/${stationName}`,
          x,
          y,
          lineColor: line.color,
          lineName: line.name,
          size: detailLevel === 1 ? 12 : detailLevel === 2 ? 10 : 8,
          visible: true,
          detailLevel,
        };

        nodes.push(node);
        linePoints.push({ x, y });
      });

      lines.push({
        id: line.name.toLowerCase().replace(/\s+/g, '-'),
        name: line.name,
        color: line.color,
        points: linePoints,
      });
    });

    return { nodes, lines };
  }, [width, height, rootPath, londonLines]);

  // Filter nodes based on zoom level with smooth transitions
  const getVisibleNodes = useCallback((nodes: MetroNode[], zoom: number): MetroNode[] => {
    return nodes.filter(node => {
      if (node.type === 'main') return true; // Always show main station

      // For smooth transitions, show nodes that are close to the current zoom level
      const _zoomThreshold = Math.floor(zoom);
      const nextZoomThreshold = Math.ceil(zoom);

      return node.detailLevel <= nextZoomThreshold;
    }).map(node => ({
      ...node,
      // Calculate opacity for smooth fade in/out during transitions
      opacity: (() => {
        if (node.type === 'main') return 1;

        const zoomDiff = zoom - node.detailLevel;
        if (zoomDiff >= 0) return 1; // Fully visible
        if (zoomDiff < -1) return 0; // Fully hidden
        return Math.max(0, 1 + zoomDiff); // Fade out
      })(),
    }));
  }, []);

  // Initialize PIXI application
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;

    try {
      const app = new PIXI.Application({
        view: canvasRef.current,
        width,
        height,
        backgroundColor: 0xf8f8f8,
        antialias: true,
      });

      appRef.current = app;

      const container = new PIXI.Container();
      containerRef.current = container;
      app.stage.addChild(container);

      // Enable interactivity
      container.interactive = true;
      container.buttonMode = true;

      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize PIXI application:', error);
    }

    return () => {
      if (appRef.current && typeof appRef.current.destroy === 'function') {
        try {
          appRef.current.destroy(true);
        } catch (error) {
          console.error('Error destroying PIXI application:', error);
        }
      }
      appRef.current = null;
      containerRef.current = null;
    };
  }, [width, height]);

  // Render the metro map
  const renderMap = useCallback(() => {
    if (!containerRef.current || !isInitialized) return;

    const container = containerRef.current;
    container.removeChildren();

    const { nodes, lines } = generateStationData();
    const visibleNodes = getVisibleNodes(nodes, zoomLevel);

    // Draw lines
    lines.forEach(line => {
      const graphics = new PIXI.Graphics();
      graphics.lineStyle(6, parseInt(line.color.replace('#', ''), 16), 1);

      if (line.points.length > 1) {
        graphics.moveTo(line.points[0].x, line.points[0].y);
        for (let i = 1; i < line.points.length; i++) {
          const point = line.points[i];
          const correspondingNode = visibleNodes.find(n =>
            Math.abs(n.x - point.x) < 5 && Math.abs(n.y - point.y) < 5
          );

          if (correspondingNode || i === 0) {
            graphics.lineTo(point.x, point.y);
          }
        }
      }

      container.addChild(graphics);
    });

    // Draw stations
     visibleNodes.forEach(node => {
       const stationContainer = new PIXI.Container();

       // Apply opacity for smooth transitions
       const nodeOpacity = node.opacity || 1;
       stationContainer.alpha = nodeOpacity;

       // Station circle with dynamic sizing based on zoom
       const circle = new PIXI.Graphics();
       const dynamicSize = node.size * (0.8 + 0.4 * Math.min(zoomLevel / 3, 1));

       circle.beginFill(parseInt(node.lineColor.replace('#', ''), 16));
       circle.lineStyle(3, 0xffffff);
       circle.drawCircle(0, 0, dynamicSize);
       circle.endFill();

       // Add glow effect for main station
       if (node.type === 'main') {
         const glow = new PIXI.Graphics();
         glow.beginFill(parseInt(node.lineColor.replace('#', ''), 16), 0.3);
         glow.drawCircle(0, 0, dynamicSize + 8);
         glow.endFill();
         stationContainer.addChild(glow);
       }

       // Station name with dynamic font size
       const fontSize = Math.max(8, Math.min(16, 8 + (zoomLevel - 1) * 3));
       const style = new PIXI.TextStyle({
         fontFamily: 'Arial, sans-serif',
         fontSize: fontSize,
         fill: 0x000000,
         fontWeight: node.type === 'main' ? 'bold' : 'normal',
         stroke: 0xffffff,
         strokeThickness: 2,
       });

       const text = new PIXI.Text(node.name, style);
       text.anchor.set(0.5, -0.5);
       text.position.set(0, -dynamicSize - 5);

       stationContainer.addChild(circle);

       // Show text based on zoom level and node importance
       const shouldShowText = zoomLevel >= 1.5 || node.type === 'main';
       if (shouldShowText) {
         text.alpha = Math.min(1, Math.max(0, (zoomLevel - 1) / 2));
         stationContainer.addChild(text);
       }

       stationContainer.position.set(node.x, node.y);
       stationContainer.interactive = nodeOpacity > 0.5;
       stationContainer.buttonMode = nodeOpacity > 0.5;

      // Event handlers
      stationContainer.on('click', () => {
        setSelectedNode(node);
        onNodeClick?.(node);
      });

      stationContainer.on('mouseover', () => {
        setHoveredNode(node);
        onNodeHover?.(node);
        circle.tint = 0xcccccc;
      });

      stationContainer.on('mouseout', () => {
        setHoveredNode(null);
        onNodeHover?.(null);
        circle.tint = 0xffffff;
      });

      container.addChild(stationContainer);
    });

  }, [generateStationData, getVisibleNodes, zoomLevel, isInitialized, onNodeClick, onNodeHover]);

  // Re-render when zoom level changes
  useEffect(() => {
    if (isInitialized) {
      renderMap();
    }
  }, [zoomLevel, isInitialized]);

  // Smooth zoom transition with animation
  const handleZoomChange = useCallback((newZoom: number) => {
    if (newZoom === zoomLevel || isTransitioning) return;

    setIsTransitioning(true);
    setTargetZoomLevel(newZoom);

    // Animate zoom transition
    const startZoom = zoomLevel;
    const duration = 500; // 500ms transition
    const startTime = Date.now();

    const animateZoom = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth transition
      const easeInOutCubic = (t: number) =>
        t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

      const easedProgress = easeInOutCubic(progress);
      const currentZoom = startZoom + (newZoom - startZoom) * easedProgress;

      setZoomLevel(currentZoom);

      if (progress < 1) {
        requestAnimationFrame(animateZoom);
      } else {
        setZoomLevel(newZoom);
        setIsTransitioning(false);
      }
    };

    requestAnimationFrame(animateZoom);
  }, [zoomLevel, isTransitioning]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Zoom Controls */}
       <div style={{
         position: 'absolute',
         top: 10,
         right: 10,
         zIndex: 10,
         backgroundColor: 'white',
         border: '2px solid #DC241F',
         borderRadius: '8px',
         padding: '10px',
         boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
         opacity: isTransitioning ? 0.8 : 1,
         transition: 'opacity 0.3s ease',
       }}>
         <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
           🔍 Zoom Level {isTransitioning && '⏳'}
         </div>
         <div style={{ marginBottom: '8px', fontSize: '10px', color: '#666' }}>
           Current: {zoomLevel.toFixed(1)}x
         </div>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
           <button
             onClick={() => handleZoomChange(1)}
             disabled={isTransitioning}
             style={{
               padding: '8px 12px',
               backgroundColor: Math.round(zoomLevel) === 1 ? '#DC241F' : 'white',
               color: Math.round(zoomLevel) === 1 ? 'white' : '#DC241F',
               border: '1px solid #DC241F',
               borderRadius: '4px',
               cursor: isTransitioning ? 'not-allowed' : 'pointer',
               fontSize: '12px',
               fontWeight: 'bold',
               opacity: isTransitioning ? 0.6 : 1,
               transition: 'all 0.2s ease',
             }}
           >
             🌍 Overview
           </button>
           <button
             onClick={() => handleZoomChange(2)}
             disabled={isTransitioning}
             style={{
               padding: '8px 12px',
               backgroundColor: Math.round(zoomLevel) === 2 ? '#DC241F' : 'white',
               color: Math.round(zoomLevel) === 2 ? 'white' : '#DC241F',
               border: '1px solid #DC241F',
               borderRadius: '4px',
               cursor: isTransitioning ? 'not-allowed' : 'pointer',
               fontSize: '12px',
               fontWeight: 'bold',
               opacity: isTransitioning ? 0.6 : 1,
               transition: 'all 0.2s ease',
             }}
           >
             🏙️ Medium
           </button>
           <button
             onClick={() => handleZoomChange(3)}
             disabled={isTransitioning}
             style={{
               padding: '8px 12px',
               backgroundColor: Math.round(zoomLevel) === 3 ? '#DC241F' : 'white',
               color: Math.round(zoomLevel) === 3 ? 'white' : '#DC241F',
               border: '1px solid #DC241F',
               borderRadius: '4px',
               cursor: isTransitioning ? 'not-allowed' : 'pointer',
               fontSize: '12px',
               fontWeight: 'bold',
               opacity: isTransitioning ? 0.6 : 1,
               transition: 'all 0.2s ease',
             }}
           >
             🔍 Detailed
           </button>
         </div>

         {/* Zoom Progress Bar */}
         <div style={{ marginTop: '8px' }}>
           <div style={{
             width: '100%',
             height: '4px',
             backgroundColor: '#f0f0f0',
             borderRadius: '2px',
             overflow: 'hidden',
           }}>
             <div style={{
               width: `${((zoomLevel - 1) / 2) * 100}%`,
               height: '100%',
               backgroundColor: '#DC241F',
               transition: isTransitioning ? 'width 0.5s ease' : 'none',
             }} />
           </div>
         </div>
       </div>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        zIndex: 10,
        backgroundColor: 'white',
        border: '2px solid #DC241F',
        borderRadius: '8px',
        padding: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        maxWidth: '200px',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
          🚇 London Underground
        </div>
        <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
          <div><strong>Zoom Levels:</strong></div>
          <div>🌍 Overview: Main stations only</div>
          <div>🏙️ Medium: + Major stations</div>
          <div>🔍 Detailed: All stations & files</div>
        </div>
      </div>

      {/* Status Display */}
      {(selectedNode || hoveredNode) && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 10,
          backgroundColor: 'white',
          border: '2px solid #0019A8',
          borderRadius: '8px',
          padding: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          minWidth: '200px',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            {hoveredNode ? '👆 Hovering' : '📍 Selected'}
          </div>
          <div style={{ fontSize: '12px' }}>
            <div><strong>Station:</strong> {(hoveredNode || selectedNode)?.name}</div>
            <div><strong>Line:</strong> {(hoveredNode || selectedNode)?.lineName}</div>
            <div><strong>Type:</strong> {(hoveredNode || selectedNode)?.type}</div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ border: '1px solid #ccc' }} />
    </div>
  );
};

export default LondonMetroPrototype;
