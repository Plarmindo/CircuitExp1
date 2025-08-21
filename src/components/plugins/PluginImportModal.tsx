import React, { useState, useRef, useCallback } from 'react';
import { Upload, Alert, Button, Modal, Spin, Typography, Space, message } from 'antd';
import { InboxOutlined, UploadOutlined, RollbackOutlined } from '@ant-design/icons';
import { ZipPluginImporter, ImportResult } from '../../plugins/import/ZipPluginImporter';

const { Dragger } = Upload;
const { Text, Title } = Typography;

interface PluginImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImportSuccess: (result: ImportResult) => void;
}

interface RollbackOption {
  pluginId: string;
  currentVersion: string;
  previousVersion: string;
  timestamp: Date;
}

export const PluginImportModal: React.FC<PluginImportModalProps> = ({
  visible,
  onClose,
  onImportSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [rollbackOptions, setRollbackOptions] = useState<RollbackOption[]>([]);
  const importer = useRef(new ZipPluginImporter());

  const loadRollbackOptions = useCallback(async () => {
    try {
      const rollbackVersions = importer.current.listRollbackVersions();
      const options: RollbackOption[] = [];
      
      Object.entries(rollbackVersions).forEach(([pluginId, versions]) => {
        if (versions.length > 0) {
          const latest = versions[0];
          options.push({
            pluginId,
            currentVersion: latest.currentVersion,
            previousVersion: latest.previousVersion,
            timestamp: latest.timestamp
          });
        }
      });
      
      setRollbackOptions(options);
    } catch (error) {
      console.error('Failed to load rollback options:', error);
    }
  }, []);

  const handleImport = useCallback(async (file: File) => {
    setLoading(true);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const result = await importer.current.importFromZip(Buffer.from(buffer));
      
      setImportResult(result);
      
      if (result.success) {
        message.success(`Plugin "${result.plugin.name}" v${result.plugin.version} imported successfully`);
        onImportSuccess(result);
        
        // Refresh rollback options
        await loadRollbackOptions();
      } else {
        message.error(`Import failed: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      message.error('Import failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }

    return false; // Prevent upload
  }, [onImportSuccess, loadRollbackOptions]);

  const handleRollback = useCallback(async (pluginId: string) => {
    setLoading(true);
    
    try {
      const success = await importer.current.rollback(pluginId);
      
      if (success) {
        message.success(`Rolled back plugin "${pluginId}" to previous version`);
        await loadRollbackOptions();
      } else {
        message.error('Rollback failed: no backup found');
      }
    } catch (error) {
      console.error('Rollback error:', error);
      message.error('Rollback failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loadRollbackOptions]);

  const draggerProps = {
    name: 'file',
    multiple: false,
    accept: '.zip',
    beforeUpload: handleImport,
    showUploadList: false
  };

  const renderImportSection = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Dragger {...draggerProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
        </p>
        <p className="ant-upload-text">Drag & Drop ZIP Plugin Here</p>
        <p className="ant-upload-hint">
          Support for CircuitExp1 plugin ZIP bundles containing plugin.json, 
          source code, and optional requirements.txt
        </p>
      </Dragger>

      <Button
        type="default"
        icon={<UploadOutlined />}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.zip';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleImport(file);
          };
          input.click();
        }}
      >
        Select ZIP File
      </Button>
    </Space>
  );

  const renderRollbackSection = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={4}>Rollback Options</Title>
      {rollbackOptions.length === 0 ? (
        <Text type="secondary">No rollback versions available</Text>
      ) : (
        rollbackOptions.map((option) => (
          <Space key={option.pluginId} style={{ width: '100%', justifyContent: 'space-between' }}>
            <div>
              <Text strong>{option.pluginId}</Text>
              <br />
              <Text type="secondary">
                Rollback from v{option.currentVersion} to v{option.previousVersion}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {option.timestamp.toLocaleString()}
              </Text>
            </div>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => handleRollback(option.pluginId)}
              size="small"
            >
              Rollback
            </Button>
          </Space>
        ))
      )}
    </Space>
  );

  const renderResult = () => {
    if (!importResult) return null;

    return (
      <Alert
        message={importResult.success ? 'Import Successful' : 'Import Failed'}
        description={
          <Space direction="vertical">
            {importResult.success && (
              <Text>
                Plugin <strong>{importResult.plugin.name}</strong> v{importResult.plugin.version} has been installed
              </Text>
            )}
            {importResult.errors.length > 0 && (
              <div>
                <Text strong>Errors:</Text>
                <ul>
                  {importResult.errors.map((error, index) => (
                    <li key={index}><Text type="danger">{error}</Text></li>
                  ))}
                </ul>
              </div>
            )}
            {importResult.warnings.length > 0 && (
              <div>
                <Text strong>Warnings:</Text>
                <ul>
                  {importResult.warnings.map((warning, index) => (
                    <li key={index}><Text type="warning">{warning}</Text></li>
                  ))}
                </ul>
              </div>
            )}
          </Space>
        }
        type={importResult.success ? 'success' : 'error'}
        showIcon
      />
    );
  };

  React.useEffect(() => {
    if (visible) {
      loadRollbackOptions();
    }
  }, [visible, loadRollbackOptions]);

  return (
    <Modal
      title="Import Plugin"
      visible={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>
      ]}
      width={600}
    >
      <Spin spinning={loading}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {renderImportSection()}
          
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            {renderRollbackSection()}
          </div>

          {renderResult()}
        </Space>
      </Spin>
    </Modal>
  );
};