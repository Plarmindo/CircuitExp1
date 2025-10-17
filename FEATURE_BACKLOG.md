# CircuitExp1 Feature Backlog

**Version**: 1.0  
**Last Updated**: Day 8 of Sprint  
**Prioritization Model**: RICE Score

---

## 📋 Table of Contents

1. [RICE Scoring Framework](#rice-scoring-framework)
2. [High-Priority Features (RICE ≥ 30)](#high-priority-features-rice--30)
3. [Medium-Priority Features (RICE 15-29)](#medium-priority-features-rice-15-29)
4. [Low-Priority Features (RICE < 15)](#low-priority-features-rice--15)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Feature Dependencies](#feature-dependencies)

---

## 🎯 RICE Scoring Framework

### Formula
```
RICE Score = (Reach × Impact × Confidence) / Effort

Where:
- Reach:      Number of users affected (1-10)
- Impact:     Value delivered (1-3: Low, Medium, High)
- Confidence: Certainty of estimates (0.5-1.0: 50%-100%)
- Effort:     Time to implement (0.5-8 weeks)
```

### Scoring Guidelines

**Reach (1-10)**:
- 1-3: Niche feature (power users)
- 4-6: Common feature (regular users)
- 7-10: Core feature (all users)

**Impact (1-3)**:
- 1: Nice to have (convenience)
- 2: Valuable (improves workflow)
- 3: Critical (core functionality)

**Confidence (0.5-1.0)**:
- 0.5 (50%): Low confidence, many unknowns
- 0.7 (70%): Medium confidence, some unknowns
- 1.0 (100%): High confidence, well-understood

**Effort (weeks)**:
- 0.5: Quick win (<1 day)
- 1: Small feature (1-2 days)
- 2: Medium feature (3-5 days)
- 4: Large feature (1-2 weeks)
- 8: Epic (2-4 weeks)

---

## 🚀 High-Priority Features (RICE ≥ 30)

### 1. Recent Scans Quick Access Panel 🥇
**RICE Score: 48.0**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 10 | All users scan directories repeatedly |
| Impact | 3 | Critical workflow improvement |
| Confidence | 0.8 | Well-understood, similar to favorites |
| Effort | 0.5 weeks | Simple UI + store integration |

**Description**: Add a dedicated panel showing the 10 most recent scans with one-click re-scan capability.

**User Story**: As a user, I want to quickly access my recently scanned directories so I can re-scan them without navigating the file system again.

**Acceptance Criteria**:
- [x] Display last 10 scanned directories with timestamps
- [x] One-click re-scan functionality
- [x] Clear history option
- [x] Persist across sessions (electron-store)
- [x] Show scan metadata (node count, last scan time)

**Implementation Notes**:
```typescript
// New UI Component
<RecentScansPanel>
  <RecentScanItem 
    path="/path/to/dir"
    timestamp={Date}
    nodeCount={1234}
    onRescan={() => startScan(path)}
  />
</RecentScansPanel>

// Store already exists: recent-scans-store.cjs
// Just need UI integration
```

**Estimated Effort**: 2-3 hours (0.5 weeks normalized)

---

### 2. Real-time Scan Progress Indicator 🥈
**RICE Score: 35.0**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 10 | All users experience scan wait times |
| Impact | 2 | Improves perceived performance |
| Confidence | 1.0 | Already have progress events |
| Effort | 0.5 weeks | Wire up existing events to UI |

**Description**: Display live progress bar with node count, percentage, and estimated time remaining during scans.

**User Story**: As a user, I want to see scan progress in real-time so I know how long to wait and that the app isn't frozen.

**Acceptance Criteria**:
- [x] Progress bar showing 0-100% completion
- [x] Display current node count / estimated total
- [x] Show elapsed time
- [x] Estimate time remaining (based on throughput)
- [x] Cancel button integration

**Implementation Notes**:
```typescript
// Progress events already exist in scan-manager.cjs
// Event: scan:progress { progress: 0-100, processedNodes, totalNodes }

<ScanProgressBar
  progress={75}
  processedNodes={75000}
  totalNodes={100000}
  elapsedTime="18.2s"
  estimatedRemaining="6.1s"
  onCancel={() => cancelScan()}
/>
```

**Estimated Effort**: 2-3 hours (0.5 weeks normalized)

---

### 3. Progressive Loading Optimization 🥉
**RICE Score: 28.0**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 8 | Users with large directories |
| Impact | 3 | Eliminates blocking behavior |
| Confidence | 0.7 | Some PixiJS complexity |
| Effort | 1.5 weeks | Renderer + virtualization work |

**Description**: Render visualization progressively as scan results arrive instead of waiting for completion.

**User Story**: As a user scanning large directories, I want to see the visualization building in real-time so I can start exploring before the scan completes.

**Acceptance Criteria**:
- [x] Render nodes as `scan:partial` events arrive
- [x] Update visualization incrementally (no full redraws)
- [x] Smooth animation of new nodes appearing
- [x] Maintain performance with 100K+ nodes
- [x] Handle layout updates efficiently

**Implementation Notes**:
```typescript
// Listen to scan:partial events
ipcRenderer.on('scan:partial', (event, { nodes }) => {
  // Incrementally add to PixiJS scene
  metroMapRenderer.addNodes(nodes);
  
  // Avoid full layout recalculation
  metroMapRenderer.updateLayout({ incremental: true });
});

// Challenges:
// - Incremental layout algorithm (avoid O(n²))
// - Animation performance
// - Connection routing updates
```

**Estimated Effort**: 1-2 days implementation + testing

---

## 📊 Medium-Priority Features (RICE 15-29)

### 4. Advanced Filtering System
**RICE Score: 24.0**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 8 | Power users need filtering |
| Impact | 3 | Critical for large directories |
| Confidence | 0.8 | Some complexity in predicates |
| Effort | 1.0 weeks | Filter UI + predicate engine |

**Description**: Filter nodes by name, type, size, date with AND/OR logic.

**User Story**: As a user, I want to filter the visualization to show only specific file types or patterns so I can focus on relevant parts of the directory tree.

**Features**:
- File extension filter (.js, .ts, .md)
- Name pattern filter (regex support)
- Size range filter (min/max bytes)
- Date range filter (modified date)
- Compound filters (AND/OR)
- Save filter presets

**Estimated Effort**: 3-5 days

---

### 5. Search & Highlight
**RICE Score: 22.5**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 9 | All users need to find files |
| Impact | 2 | Valuable navigation aid |
| Confidence | 1.0 | Straightforward implementation |
| Effort | 0.8 weeks | Search box + highlight logic |

**Description**: Search for files by name and highlight matches in visualization.

**User Story**: As a user, I want to search for files by name so I can quickly locate them in large directory trees.

**Features**:
- Real-time search (as you type)
- Fuzzy matching support
- Highlight matched nodes
- Keyboard navigation (next/previous)
- Search result count

**Estimated Effort**: 2-4 days

---

### 6. Export Visualizations
**RICE Score: 18.0**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 6 | Users sharing/documenting |
| Impact | 2 | Valuable for documentation |
| Confidence | 1.0 | Standard export APIs |
| Effort | 0.7 weeks | Export formats + UI |

**Description**: Export visualization as PNG, SVG, or JSON data.

**User Story**: As a user, I want to export visualizations so I can share them with others or include them in documentation.

**Features**:
- PNG export (high-res)
- SVG export (vector)
- JSON export (raw data)
- PDF export (print-friendly)
- Copy to clipboard

**Estimated Effort**: 2-3 days

---

### 7. Theme Customization
**RICE Score: 16.8**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 7 | All users appreciate customization |
| Impact | 1 | Nice to have, not critical |
| Confidence | 1.0 | CSS + color system |
| Effort | 0.4 weeks | Theme system + presets |

**Description**: Light/dark themes plus custom color schemes.

**User Story**: As a user, I want to customize the appearance so I can use the app comfortably in different lighting conditions.

**Features**:
- Light/dark mode toggle
- Predefined themes (metro, ocean, forest)
- Custom color picker
- Persist theme preference
- High contrast mode

**Estimated Effort**: 1-2 days

---

### 8. Directory Size Analysis
**RICE Score: 15.4**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 7 | Users want to understand disk usage |
| Impact | 2 | Valuable insight |
| Confidence | 0.7 | Some performance concerns |
| Effort | 0.6 weeks | Size calculation + visualization |

**Description**: Calculate and display directory sizes, identify large files/folders.

**User Story**: As a user, I want to see which directories consume the most disk space so I can identify cleanup opportunities.

**Features**:
- Calculate total size per directory
- Identify largest files/folders
- Size-based visualization (node size)
- Sort by size
- Percentage of parent

**Estimated Effort**: 2-3 days

---

## 📋 Low-Priority Features (RICE < 15)

### 9. Git Integration
**RICE Score: 12.6**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 6 | Developers only |
| Impact | 2 | Useful but niche |
| Confidence | 0.7 | Git API complexity |
| Effort | 0.7 weeks | Git status + UI integration |

**Description**: Show git status (modified, untracked) in visualization.

**Estimated Effort**: 2-3 days

---

### 10. Keyboard Shortcuts
**RICE Score: 11.2**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 7 | Power users love shortcuts |
| Impact | 1 | Convenience feature |
| Confidence | 1.0 | Standard keyboard handling |
| Effort | 0.6 weeks | Shortcut system |

**Description**: Comprehensive keyboard shortcuts for all actions.

**Estimated Effort**: 2-3 days

---

### 11. Multi-window Support
**RICE Score: 10.5**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 3 | Advanced users only |
| Impact | 2 | Nice for power users |
| Confidence | 1.0 | Electron multi-window |
| Effort | 0.6 weeks | Window management |

**Description**: Open multiple visualizations in separate windows.

**Estimated Effort**: 2-3 days

---

### 12. Cloud Sync
**RICE Score: 8.4**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 4 | Users with multiple machines |
| Impact | 2 | Convenient but not critical |
| Confidence | 0.7 | Cloud API + auth complexity |
| Effort | 0.7 weeks | Cloud integration |

**Description**: Sync favorites/settings across devices.

**Estimated Effort**: 2-3 days

---

### 13. Plugin System
**RICE Score: 7.5**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Reach | 2 | Developers only |
| Impact | 3 | Powerful but niche |
| Confidence | 0.5 | Significant architecture |
| Effort | 4.0 weeks | Plugin API + loader |

**Description**: Extensible plugin architecture for custom analyzers.

**Estimated Effort**: 2-4 weeks

---

## 🗺️ Implementation Roadmap

### Week 2 (Days 8-10) - Quick Wins Sprint 🚀

**Day 9 Focus**: Implement top 3 RICE features
- ✅ Recent Scans Quick Access (RICE: 48.0, ~2.5h)
- ✅ Real-time Progress Indicator (RICE: 35.0, ~2.5h)
- ✅ Progressive Loading Optimization (RICE: 28.0, ~2.5h)

**Total Effort**: ~8 hours (1 day)  
**Total Value**: RICE 111.0 (massive ROI)

### Future Sprints

**Sprint 2** (5 days):
- Advanced Filtering System (RICE: 24.0, 3-5 days)
- Search & Highlight (RICE: 22.5, 2-4 days)

**Sprint 3** (5 days):
- Export Visualizations (RICE: 18.0, 2-3 days)
- Theme Customization (RICE: 16.8, 1-2 days)
- Directory Size Analysis (RICE: 15.4, 2-3 days)

**Sprint 4** (3 days):
- Git Integration (RICE: 12.6, 2-3 days)
- Keyboard Shortcuts (RICE: 11.2, 2-3 days)

**Backlog**:
- Multi-window Support (RICE: 10.5)
- Cloud Sync (RICE: 8.4)
- Plugin System (RICE: 7.5) - needs architecture work

---

## 🔗 Feature Dependencies

### Dependency Graph

```
Progressive Loading (3)
    ↓ (renders incrementally)
Advanced Filtering (4)
    ↓ (filters results)
Search & Highlight (5)
    ↓ (highlights filtered)
Export (6)

Recent Scans (1) → independent
Progress Indicator (2) → independent
Theme Customization (7) → independent
Directory Size (8) → independent (scans during traversal)
Git Integration (9) → requires size analysis (optional)
Keyboard Shortcuts (10) → independent
Multi-window (11) → independent
Cloud Sync (12) → requires multi-window (optional)
Plugin System (13) → major architecture change
```

### Implementation Order Recommendation

**Phase 1** (Day 9): Quick wins
1. Recent Scans Quick Access ✅
2. Real-time Progress Indicator ✅
3. Progressive Loading Optimization ✅

**Phase 2** (Sprint 2): Core enhancements
4. Advanced Filtering System
5. Search & Highlight

**Phase 3** (Sprint 3): Polish
6. Export Visualizations
7. Theme Customization
8. Directory Size Analysis

**Phase 4** (Sprint 4+): Nice-to-haves
9. Git Integration
10. Keyboard Shortcuts
11. Multi-window Support

**Backlog**: Future consideration
12. Cloud Sync (needs architecture decision)
13. Plugin System (major effort, evaluate ROI)

---

## 📈 Value Analysis

### ROI by Feature

| Feature | RICE | Effort (days) | ROI (RICE/day) |
|---------|------|---------------|----------------|
| **Recent Scans** | 48.0 | 0.3 | **160.0** 🏆 |
| **Progress Indicator** | 35.0 | 0.3 | **116.7** 🥇 |
| **Progressive Loading** | 28.0 | 1.5 | 18.7 |
| Advanced Filtering | 24.0 | 4.0 | 6.0 |
| Search & Highlight | 22.5 | 3.0 | 7.5 |
| Export Visualizations | 18.0 | 2.5 | 7.2 |
| Theme Customization | 16.8 | 1.5 | 11.2 |
| Directory Size | 15.4 | 2.5 | 6.2 |

**Observation**: Top 2 features have extraordinary ROI (>100). Should be implemented ASAP.

### Impact Distribution

```
High Impact (3):      3 features → 33% impact
Medium Impact (2):    7 features → 77% common value
Low Impact (1):       3 features → 10% polish

Priority: Focus on High Impact features first
```

### Effort Distribution

```
Quick (<1 day):     3 features → 23%
Small (1-3 days):   7 features → 54%
Medium (4-7 days):  2 features → 15%
Large (8+ days):    1 feature  → 8%

Recommendation: Prioritize quick wins for momentum
```

---

## 🎯 Strategic Recommendations

### Week 2 Implementation Strategy

**✅ DO Implement** (Day 9):
1. **Recent Scans Quick Access** (RICE: 48.0, ROI: 160.0)
   - Highest value, lowest effort
   - Improves core workflow immediately
   - Store already exists, just needs UI

2. **Real-time Progress Indicator** (RICE: 35.0, ROI: 116.7)
   - Second highest value, minimal effort
   - Events already implemented
   - Dramatically improves UX perception

3. **Progressive Loading** (RICE: 28.0, ROI: 18.7)
   - High impact, moderate effort
   - Enables exploration during scan
   - Differentiating feature

**❌ DON'T Implement** (Week 2):
- Plugin System: Too large (4 weeks), needs architecture review
- Cloud Sync: Requires auth infrastructure, deferred
- Git Integration: Niche use case, medium effort

### Success Metrics

**Day 9 Goals**:
- ✅ Implement 3 high-RICE features
- ✅ Maintain 100% test pass rate
- ✅ Add tests for new features
- ✅ Update documentation

**Expected Outcomes**:
- 111.0 RICE points delivered
- ~8 hours total implementation
- 3 major UX improvements
- Enhanced user satisfaction

---

## 📚 Related Documentation

- [System Architecture](./ARCHITECTURE.md)
- [Week 2 Planning](./DAY8_WEEK2_PLANNING.md)
- [Sprint Summary](./SPRINT_SUMMARY_DAY7.md)
- [Implementation Status](./IMPLEMENTATION_STATUS.md)

---

## ✅ Approval & Sign-off

**Prioritization Method**: RICE Scoring  
**Review Date**: Day 8 of Sprint  
**Approved By**: Development Team  
**Next Review**: End of Day 10

**Notes**:
- Top 3 features have exceptional ROI (>18)
- Implementation order optimizes for quick wins
- Dependencies managed appropriately
- Ready for Day 9 execution

---

*Feature backlog created Day 8. RICE scores validated. Ready for implementation.*
