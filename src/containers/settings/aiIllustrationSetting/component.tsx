import React from "react";
import { AIIllustrationSettingProps, AIIllustrationSettingState } from "./interface";
import { Trans } from "react-i18next";
import { AIIllustrationConfigService } from "../../../services/utils/config";
import { aiIllustrationService } from "../../../services/aiIllustrationService";
import toast from "react-hot-toast";
import "./aiIllustrationSetting.css";

class AIIllustrationSetting extends React.Component<
  AIIllustrationSettingProps,
  AIIllustrationSettingState
> {
  constructor(props: AIIllustrationSettingProps) {
    super(props);
    
    const config = AIIllustrationConfigService.getConfig();
    this.state = {
      isEnabled: config.enabled,
      frequency: config.frequency,
      imageQuality: config.imageQuality,
      cacheSize: config.cacheSize,
      showNotifications: config.showNotifications,
      isLoading: false,
      cacheStats: null,
    };
  }

  componentDidMount() {
    this.loadCacheStats();
  }

  loadCacheStats = async () => {
    try {
      const stats = await aiIllustrationService.getCacheStats();
      this.setState({
        cacheStats: {
          totalEntries: stats.combined.totalUniqueKeys,
          estimatedSizeBytes: stats.memory.estimatedSizeBytes + stats.persistent.estimatedSizeBytes,
          memoryHitRate: stats.combined.memoryHitRate,
        },
      });
    } catch (error) {
      console.warn('Failed to load cache stats:', error);
    }
  };

  handleToggleEnabled = () => {
    const newEnabled = !this.state.isEnabled;
    this.setState({ isEnabled: newEnabled });
    
    AIIllustrationConfigService.updateConfig({ enabled: newEnabled });
    toast.success(this.props.t("Change successful"));
  };

  handleFrequencyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const frequency = event.target.value as 'every-page' | 'every-second-page' | 'every-third-page';
    this.setState({ frequency });
    
    AIIllustrationConfigService.updateConfig({ frequency });
    toast.success(this.props.t("Change successful"));
  };

  handleQualityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const imageQuality = event.target.value as 'standard' | 'high';
    this.setState({ imageQuality });
    
    AIIllustrationConfigService.updateConfig({ imageQuality });
    toast.success(this.props.t("Change successful"));
  };

  handleCacheSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const cacheSize = parseInt(event.target.value);
    if (cacheSize >= 10 && cacheSize <= 1000) {
      this.setState({ cacheSize });
      AIIllustrationConfigService.updateConfig({ cacheSize });
      toast.success(this.props.t("Change successful"));
    }
  };

  handleNotificationsToggle = () => {
    const newShowNotifications = !this.state.showNotifications;
    this.setState({ showNotifications: newShowNotifications });
    
    AIIllustrationConfigService.updateConfig({ showNotifications: newShowNotifications });
    toast.success(this.props.t("Change successful"));
  };

  handleClearCache = async () => {
    this.setState({ isLoading: true });
    
    try {
      await aiIllustrationService.clearCache();
      await this.loadCacheStats();
      toast.success(this.props.t("Cache cleared successfully"));
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error(this.props.t("Failed to clear cache"));
    } finally {
      this.setState({ isLoading: false });
    }
  };

  formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  render() {
    const { cacheStats } = this.state;

    return (
      <div className="ai-illustration-main-setting">
        {/* Enable/Disable Toggle */}
        <div className="setting-dialog-new-title">
          <span style={{ width: "calc(100% - 100px)" }}>
            <Trans>Enable AI illustrations</Trans>
          </span>
          <span
            className="single-control-switch"
            onClick={this.handleToggleEnabled}
            style={this.state.isEnabled ? {} : { opacity: 0.6 }}
          >
            <span
              className="single-control-button"
              style={
                this.state.isEnabled
                  ? {
                      transform: "translateX(20px)",
                      transition: "transform 0.5s ease",
                    }
                  : {
                      transform: "translateX(0px)",
                      transition: "transform 0.5s ease",
                    }
              }
            ></span>
          </span>
        </div>
        <p className="setting-option-subtitle">
          <Trans>Generate contextual illustrations for your books using AI</Trans>
        </p>

        {this.state.isEnabled && (
          <>
            {/* Frequency Setting */}
            <div className="setting-dialog-new-title">
              <Trans>Illustration frequency</Trans>
              <select
                className="lang-setting-dropdown"
                value={this.state.frequency}
                onChange={this.handleFrequencyChange}
              >
                <option value="every-page">
                  {this.props.t("Every page")}
                </option>
                <option value="every-second-page">
                  {this.props.t("Every second page")}
                </option>
                <option value="every-third-page">
                  {this.props.t("Every third page")}
                </option>
              </select>
            </div>

            {/* Image Quality Setting */}
            <div className="setting-dialog-new-title">
              <Trans>Image quality</Trans>
              <select
                className="lang-setting-dropdown"
                value={this.state.imageQuality}
                onChange={this.handleQualityChange}
              >
                <option value="standard">
                  {this.props.t("Standard")}
                </option>
                <option value="high">
                  {this.props.t("High")}
                </option>
              </select>
            </div>

            {/* Cache Size Setting */}
            <div className="setting-dialog-new-title">
              <Trans>Cache size (MB)</Trans>
              <input
                type="number"
                className="ai-cache-size-input"
                min="10"
                max="1000"
                value={this.state.cacheSize}
                onChange={this.handleCacheSizeChange}
              />
            </div>

            {/* Notifications Toggle */}
            <div className="setting-dialog-new-title">
              <span style={{ width: "calc(100% - 100px)" }}>
                <Trans>Show error notifications</Trans>
              </span>
              <span
                className="single-control-switch"
                onClick={this.handleNotificationsToggle}
                style={this.state.showNotifications ? {} : { opacity: 0.6 }}
              >
                <span
                  className="single-control-button"
                  style={
                    this.state.showNotifications
                      ? {
                          transform: "translateX(20px)",
                          transition: "transform 0.5s ease",
                        }
                      : {
                          transform: "translateX(0px)",
                          transition: "transform 0.5s ease",
                        }
                  }
                ></span>
              </span>
            </div>
            <p className="setting-option-subtitle">
              <Trans>Show notifications when AI illustration generation fails</Trans>
            </p>

            {/* Cache Management */}
            <div className="ai-cache-management-main">
              <div className="setting-dialog-new-title">
                <Trans>Cache Management</Trans>
              </div>
              
              {cacheStats && (
                <div className="ai-cache-stats-main">
                  <div className="ai-cache-stat-main">
                    <span className="ai-cache-stat-label-main">
                      <Trans>Total illustrations</Trans>: {cacheStats.totalEntries}
                    </span>
                  </div>
                  <div className="ai-cache-stat-main">
                    <span className="ai-cache-stat-label-main">
                      <Trans>Cache size</Trans>: {this.formatBytes(cacheStats.estimatedSizeBytes)}
                    </span>
                  </div>
                  <div className="ai-cache-stat-main">
                    <span className="ai-cache-stat-label-main">
                      <Trans>Hit rate</Trans>: {(cacheStats.memoryHitRate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              <div className="setting-dialog-new-title">
                <Trans>Clear illustration cache</Trans>
                <span
                  className="change-location-button"
                  onClick={this.handleClearCache}
                  style={this.state.isLoading ? { opacity: 0.6, pointerEvents: 'none' } : {}}
                >
                  {this.state.isLoading ? (
                    <Trans>Clearing...</Trans>
                  ) : (
                    <Trans>Clear Cache</Trans>
                  )}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
}

export default AIIllustrationSetting;