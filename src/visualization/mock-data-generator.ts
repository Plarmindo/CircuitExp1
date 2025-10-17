/**
 * Mock Data Generator for Three Folder Prototype
 * Creates a simple visualization with three folders, each containing one file,
 * connected by lines to demonstrate the metro map concept.
 */

import type { LayoutNodeLite, RouteCommand } from './stage/types';

export interface MockFolder {
  path: string;
  name: string;
  x: number;
  y: number;
  file: {
    path: string;
    name: string;
    x: number;
    y: number;
  };
}

export interface MockDataResult {
  layout: LayoutNodeLite[];
  routes: RouteCommand[];
  folders: MockFolder[];
}

/**
 * Generate mock data for three folders with connecting lines
 */
export function generateThreeFolderMock(): MockDataResult {
  const folders: MockFolder[] = [
    {
      path: '/Documents',
      name: 'Documents',
      x: 100,
      y: 200,
      file: {
        path: '/Documents/report.pdf',
        name: 'report.pdf',
        x: 100,
        y: 280,
      },
    },
    {
      path: '/Projects',
      name: 'Projects',
      x: 400,
      y: 150,
      file: {
        path: '/Projects/app.js',
        name: 'app.js',
        x: 400,
        y: 230,
      },
    },
    {
      path: '/Images',
      name: 'Images',
      x: 700,
      y: 200,
      file: {
        path: '/Images/photo.jpg',
        name: 'photo.jpg',
        x: 700,
        y: 280,
      },
    },
  ];

  // Create layout nodes for folders and files
  const layout: LayoutNodeLite[] = [];

  folders.forEach((folder) => {
    // Add folder node
    layout.push({
      path: folder.path,
      x: folder.x,
      y: folder.y,
      width: 120,
      height: 40,
      depth: 0,
      aggregated: false,
      children: [folder.file.path],
      parent: null,
      color: '#4CAF50', // Green for folders
      label: folder.name,
      nodeType: 'folder',
    });

    // Add file node
    layout.push({
      path: folder.file.path,
      x: folder.file.x,
      y: folder.file.y,
      width: 100,
      height: 30,
      depth: 1,
      aggregated: false,
      children: [],
      parent: folder.path,
      color: '#2196F3', // Blue for files
      label: folder.file.name,
      nodeType: 'file',
    });
  });

  // Create connecting routes between folders (metro lines)
  const routes: RouteCommand[] = [
    // Line from Documents to Projects
    {
      type: 'M', // Move to
      x: folders[0].x + 60, // Center of Documents folder
      y: folders[0].y + 20,
    },
    {
      type: 'Q', // Quadratic curve
      cx: 250, // Control point
      cy: 120,
      x: folders[1].x + 60, // End at Projects folder
      y: folders[1].y + 20,
    },

    // Line from Projects to Images
    {
      type: 'M', // Move to
      x: folders[1].x + 60, // Center of Projects folder
      y: folders[1].y + 20,
    },
    {
      type: 'Q', // Quadratic curve
      cx: 550, // Control point
      cy: 120,
      x: folders[2].x + 60, // End at Images folder
      y: folders[2].y + 20,
    },

    // Line from Images back to Documents (completing the circuit)
    {
      type: 'M', // Move to
      x: folders[2].x + 60, // Center of Images folder
      y: folders[2].y + 20,
    },
    {
      type: 'Q', // Quadratic curve
      cx: 400, // Control point
      cy: 320,
      x: folders[0].x + 60, // End at Documents folder
      y: folders[0].y + 20,
    },

    // Vertical lines connecting folders to their files
    {
      type: 'M', // Documents to its file
      x: folders[0].x + 60,
      y: folders[0].y + 40,
    },
    {
      type: 'L', // Line to
      x: folders[0].file.x + 50,
      y: folders[0].file.y,
    },

    {
      type: 'M', // Projects to its file
      x: folders[1].x + 60,
      y: folders[1].y + 40,
    },
    {
      type: 'L', // Line to
      x: folders[1].file.x + 50,
      y: folders[1].file.y,
    },

    {
      type: 'M', // Images to its file
      x: folders[2].x + 60,
      y: folders[2].y + 40,
    },
    {
      type: 'L', // Line to
      x: folders[2].file.x + 50,
      y: folders[2].file.y,
    },
  ];

  return {
    layout,
    routes,
    folders,
  };
}

/**
 * Generate a more complex mock with additional connections
 */
export function generateExtendedMock(): MockDataResult {
  const basicMock = generateThreeFolderMock();

  // Add additional nodes for a more complex visualization
  const additionalNodes: LayoutNodeLite[] = [
    {
      path: '/Shared',
      x: 400,
      y: 350,
      width: 100,
      height: 35,
      depth: 0,
      aggregated: false,
      children: [],
      parent: null,
      color: '#FF9800', // Orange for shared folder
      label: 'Shared',
      nodeType: 'folder',
    },
  ];

  // Add routes connecting to the shared folder
  const additionalRoutes: RouteCommand[] = [
    // Connect all three main folders to the shared folder
    {
      type: 'M',
      x: basicMock.folders[0].x + 60,
      y: basicMock.folders[0].y + 40,
    },
    {
      type: 'L',
      x: 400 + 50, // Shared folder center
      y: 350 + 17,
    },
    {
      type: 'M',
      x: basicMock.folders[1].x + 60,
      y: basicMock.folders[1].y + 40,
    },
    {
      type: 'L',
      x: 400 + 50,
      y: 350 + 17,
    },
    {
      type: 'M',
      x: basicMock.folders[2].x + 60,
      y: basicMock.folders[2].y + 40,
    },
    {
      type: 'L',
      x: 400 + 50,
      y: 350 + 17,
    },
  ];

  return {
    layout: [...basicMock.layout, ...additionalNodes],
    routes: [...basicMock.routes, ...additionalRoutes],
    folders: basicMock.folders,
  };
}

/**
 * Create a simple linear connection between nodes
 */
export function createLinearRoute(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  style: 'straight' | 'curved' = 'curved'
): RouteCommand[] {
  if (style === 'straight') {
    return [
      { type: 'M', x: startX, y: startY },
      { type: 'L', x: endX, y: endY },
    ];
  }

  // Curved line with control point
  const midX = (startX + endX) / 2;
  const midY = Math.min(startY, endY) - 50; // Control point above the line

  return [
    { type: 'M', x: startX, y: startY },
    {
      type: 'Q',
      cx: midX,
      cy: midY,
      x: endX,
      y: endY,
    },
  ];
}
