import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export interface PerformanceMetric {
  timestamp: number;
  memoryUsage: number;
  cpuUsage: number;
  fileCount: number;
  scanSpeed: number;
  errorCount: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: number;
  severity: number;
}

interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ isVisible, onClose }) => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [currentTab, setCurrentTab] = useState('overview');
  const [realTimeMonitoring, setRealTimeMonitoring] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (realTimeMonitoring && isVisible) {
      intervalRef.current = setInterval(() => {
        collectMetrics();
      }, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [realTimeMonitoring, isVisible]);

  const collectMetrics = async () => {
    try {
      // Get performance data from Electron main process
      const performanceData = await window.electronAPI?.getPerformanceMetrics?.();
      
      if (performanceData) {
        const newMetric: PerformanceMetric = {
          timestamp: Date.now(),
          memoryUsage: performanceData.memoryUsage || 0,
          cpuUsage: performanceData.cpuUsage || 0,
          fileCount: performanceData.fileCount || 0,
          scanSpeed: performanceData.scanSpeed || 0,
          errorCount: performanceData.errorCount || 0
        };

        setMetrics(prev => {
          const updated = [...prev, newMetric];
          // Keep only last 100 data points
          return updated.slice(-100);
        });

        // Check for performance issues
        checkPerformanceAlerts(newMetric);
      }
    } catch (error) {
      console.error('Failed to collect performance metrics:', error);
    }
  };

  const checkPerformanceAlerts = (metric: PerformanceMetric) => {
    const newAlerts: PerformanceAlert[] = [];

    // Memory usage alert
    if (metric.memoryUsage > 80) {
      newAlerts.push({
        id: `mem_${Date.now()}`,
        type: 'warning',
        message: `High memory usage: ${metric.memoryUsage.toFixed(1)}%`,
        timestamp: metric.timestamp,
        severity: metric.memoryUsage > 90 ? 3 : 2
      });
    }

    // CPU usage alert
    if (metric.cpuUsage > 75) {
      newAlerts.push({
        id: `cpu_${Date.now()}`,
        type: 'warning',
        message: `High CPU usage: ${metric.cpuUsage.toFixed(1)}%`,
        timestamp: metric.timestamp,
        severity: metric.cpuUsage > 85 ? 3 : 2
      });
    }

    // Error count alert
    if (metric.errorCount > 0) {
      newAlerts.push({
        id: `err_${Date.now()}`,
        type: 'error',
        message: `${metric.errorCount} errors detected during scan`,
        timestamp: metric.timestamp,
        severity: 3
      });
    }

    // Scan speed alert
    if (metric.scanSpeed < 100) {
      newAlerts.push({
        id: `speed_${Date.now()}`,
        type: 'info',
        message: `Slow scan speed: ${metric.scanSpeed.toFixed(1)} files/sec`,
        timestamp: metric.timestamp,
        severity: 1
      });
    }

    setAlerts(prev => [...newAlerts, ...prev].slice(-10));
  };

  const getLatestMetric = () => {
    return metrics[metrics.length - 1] || {
      timestamp: Date.now(),
      memoryUsage: 0,
      cpuUsage: 0,
      fileCount: 0,
      scanSpeed: 0,
      errorCount: 0
    };
  };

  const getAverageMetrics = () => {
    if (metrics.length === 0) return { memoryUsage: 0, cpuUsage: 0, scanSpeed: 0 };
    
    const avg = {
      memoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length,
      cpuUsage: metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length,
      scanSpeed: metrics.reduce((sum, m) => sum + m.scanSpeed, 0) / metrics.length
    };
    
    return avg;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!isVisible) return null;

  const latest = getLatestMetric();
  const averages = getAverageMetrics();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-screen overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Performance Dashboard</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setRealTimeMonitoring(!realTimeMonitoring)}
                className={`px-3 py-1 rounded text-sm ${
                  realTimeMonitoring 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {realTimeMonitoring ? 'Live' : 'Paused'}
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{latest.memoryUsage.toFixed(1)}%</div>
                    <Progress value={latest.memoryUsage} className="mt-2" />
                    <p className="text-xs text-gray-500 mt-1">
                      Avg: {averages.memoryUsage.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{latest.cpuUsage.toFixed(1)}%</div>
                    <Progress value={latest.cpuUsage} className="mt-2" />
                    <p className="text-xs text-gray-500 mt-1">
                      Avg: {averages.cpuUsage.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Files Scanned</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{latest.fileCount}</div>
                    <p className="text-xs text-gray-500 mt-1">
                      Speed: {latest.scanSpeed.toFixed(1)}/sec
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      <Badge variant={latest.errorCount > 0 ? 'destructive' : 'default'}>
                        {latest.errorCount}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Current scan
                    </p>
                  </CardContent>
                </Card>
              </div>

              {alerts.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">Recent Alerts</h3>
                  <div className="space-y-2">
                    {alerts.slice(0, 5).map(alert => (
                      <Alert key={alert.id} variant={alert.type}>
                        <AlertDescription>
                          {formatTimestamp(alert.timestamp)}: {alert.message}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatTimestamp}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      labelFormatter={formatTimestamp}
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(1)}%`, 
                        name.replace(/([A-Z])/g, ' $1').trim()
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="memoryUsage" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cpuUsage" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="metrics">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Memory Usage Over Time</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} />
                        <YAxis />
                        <Tooltip labelFormatter={formatTimestamp} />
                        <Area 
                          type="monotone" 
                          dataKey="memoryUsage" 
                          stroke="#8884d8" 
                          fill="#8884d8" 
                          fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Scan Performance</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.slice(-20)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} />
                        <YAxis />
                        <Tooltip labelFormatter={formatTimestamp} />
                        <Bar dataKey="scanSpeed" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="alerts">
              <div className="space-y-4">
                {alerts.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No alerts to display</p>
                ) : (
                  alerts.map(alert => (
                    <Card key={alert.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge 
                              variant={alert.type === 'error' ? 'destructive' : 
                                       alert.type === 'warning' ? 'warning' : 'default'}
                            >
                              {alert.type.toUpperCase()}
                            </Badge>
                            <p className="mt-2">{alert.message}</p>
                          </div>
                          <span className="text-sm text-gray-500">
                            {formatTimestamp(alert.timestamp)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="analysis">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Memory Efficiency</h4>
                        <p className="text-sm text-gray-600">
                          Average memory usage: {averages.memoryUsage.toFixed(1)}%
                          {averages.memoryUsage > 70 && " - Consider optimizing memory usage"}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Processing Speed</h4>
                        <p className="text-sm text-gray-600">
                          Average scan speed: {averages.scanSpeed.toFixed(1)} files/sec
                          {averages.scanSpeed < 50 && " - Performance may be impacted"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      {averages.memoryUsage > 70 && (
                        <li>• Consider implementing memory cleanup during long scans</li>
                      )}
                      {averages.cpuUsage > 60 && (
                        <li>• Monitor CPU usage during peak scanning periods</li>
                      )}
                      {averages.scanSpeed < 50 && (
                        <li>• Optimize file processing algorithms for better performance</li>
                      )}
                      <li>• Enable performance monitoring for production deployments</li>
                      <li>• Set up automated alerts for critical performance thresholds</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};