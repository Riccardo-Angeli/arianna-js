/**
 * @module    arianna-controls
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * AriannA UI Controls — single barrel export.
 * One import to get everything.
 *
 * @example
 *   import { TreeView, Table, Button, Snackbar, Theme } from 'arianna-wip/controls';
 *   Theme.apply('dark');
 *   Theme.inject();
 *
 *   const tree = new TreeView('#nav');
 *   tree.nodes = myData;
 *   tree.on('select', ({ node }) => console.log(node));
 *
 *   Snackbar.show('Ready!', { variant: 'success' });
 */

// Core
export { Control }    from './core/Control.ts';
export { Theme }      from './core/Theme.ts';
export type { CtrlOptions, CtrlListener } from './core/Control.ts';
export type { ThemeMode, ThemeTokens }   from './core/Theme.ts';

// Data
export { TreeView, TreeViewCSS }  from './data/TreeView.ts';
export { Table }     from './data/Table.ts';
export type { TreeNode, TreeViewOptions }                   from './data/TreeView.ts';
export type { TableColumn, TableOptions, SortState, Row, FetchFn } from './data/Table.ts';

// Layout
export { Accordion } from './layout/Accordion.ts';
export { Card,      CardCSS }      from './layout/Card.ts';
export { Drawer,    DrawerCSS }    from './layout/Drawer.ts';
export { Modal,     ModalCSS }     from './layout/Modal.ts';
export { Panel,     PanelCSS }     from './layout/Panel.ts';
export { Splitter,  SplitterCSS }  from './layout/Splitter.ts';
export { Tabs,      TabsCSS }      from './layout/Tabs.ts';
export type { AccordionItem, AccordionOptions } from './layout/Accordion.ts';
export type { CardOptions }                     from './layout/Card.ts';
export type { DrawerOptions }                   from './layout/Drawer.ts';
export type { ModalOptions }                    from './layout/Modal.ts';
export type { PanelOptions }                    from './layout/Panel.ts';
export type { SplitterOptions }                 from './layout/Splitter.ts';
export type { TabItem, TabsOptions }            from './layout/Tabs.ts';

// Navigation
export { Breadcrumb, BreadcrumbCSS } from './navigation/Breadcrumb.ts';
export { Header,     HeaderCSS }     from './navigation/Header.ts';
export { Menu,       MenuCSS }       from './navigation/Menu.ts';
export { NavRail,    NavRailCSS }    from './navigation/NavRail.ts';
export { Pagination, PaginationCSS } from './navigation/Pagination.ts';
export { Stepper,    StepperCSS }    from './navigation/Stepper.ts';
export type { BreadcrumbItem, BreadcrumbOptions } from './navigation/Breadcrumb.ts';
export type { HeaderOptions }                     from './navigation/Header.ts';
export type { MenuItem }                          from './navigation/Menu.ts';
export type { NavRailItem, NavRailOptions }       from './navigation/NavRail.ts';
export type { PaginationOptions }                 from './navigation/Pagination.ts';
export type { StepperOptions }                    from './navigation/Stepper.ts';

// Inputs
export { Button,      ButtonCSS }      from './inputs/Button.ts';
export { Checkbox,    CheckboxCSS }    from './inputs/Checkbox.ts';
export { Chip,        ChipCSS }        from './inputs/Chip.ts';
export { ColorPicker, ColorPickerCSS } from './inputs/ColorPicker.ts';
export { DatePicker,  DatePickerCSS }  from './inputs/DatePicker.ts';
export { Dropdown,    DropdownCSS }    from './inputs/Dropdown.ts';
export { FileUpload,  FileUploadCSS }  from './inputs/FileUpload.ts';
export { Radio,       RadioCSS }       from './inputs/Radio.ts';
export { RangeSlider, RangeSliderCSS } from './inputs/RangeSlider.ts';
export { Rating,      RatingCSS }      from './inputs/Rating.ts';
export { SearchBar,   SearchBarCSS }   from './inputs/SearchBar.ts';
export { Switch,      SwitchCSS }      from './inputs/Switch.ts';
export { TextField,   TextFieldCSS }   from './inputs/TextField.ts';
export { TimePicker,  TimePickerCSS }  from './inputs/TimePicker.ts';
export type { ButtonOptions }      from './inputs/Button.ts';
export type { CheckboxOptions }    from './inputs/Checkbox.ts';
export type { ChipOptions }        from './inputs/Chip.ts';
export type { ColorPickerOptions } from './inputs/ColorPicker.ts';
export type { DatePickerOptions }  from './inputs/DatePicker.ts';
export type { DropdownOption, DropdownOptions } from './inputs/Dropdown.ts';
export type { FileUploadOptions }  from './inputs/FileUpload.ts';
export type { RadioOption, RadioOptions } from './inputs/Radio.ts';
export type { RangeSliderOptions } from './inputs/RangeSlider.ts';
export type { RatingOptions }      from './inputs/Rating.ts';
export type { SearchBarOptions }   from './inputs/SearchBar.ts';
export type { SwitchOptions }      from './inputs/Switch.ts';
export type { TextFieldOptions }   from './inputs/TextField.ts';
export type { TimePickerOptions }  from './inputs/TimePicker.ts';

// Display
export { Avatar,           AvatarCSS }           from './display/Avatar.ts';
export { Badge,            BadgeCSS }             from './display/Badge.ts';
export { Banner,           BannerCSS }            from './display/Banner.ts';
export { Divider,          DividerCSS }           from './display/Divider.ts';
export { Icon,             IconCSS }              from './display/Icon.ts';
export { List,             ListCSS }              from './display/List.ts';
export { ProgressBar,      ProgressBarCSS }       from './display/ProgressBar.ts';
export { ProgressCircular, ProgressCircularCSS }  from './display/ProgressCircular.ts';
export { Skeleton,         SkeletonCSS }          from './display/Skeleton.ts';
export { Snackbar,         SnackbarCSS }          from './display/Snackbar.ts';
export { Tag,              TagCSS }               from './display/Tag.ts';
export { Tooltip,          TooltipCSS }           from './display/Tooltip.ts';
export type { AvatarOptions }           from './display/Avatar.ts';
export type { BadgeOptions }            from './display/Badge.ts';
export type { BannerOptions }           from './display/Banner.ts';
export type { DividerOptions }          from './display/Divider.ts';
export type { IconOptions }             from './display/Icon.ts';
export type { ListItem, ListOptions }   from './display/List.ts';
export type { ProgressBarOptions }      from './display/ProgressBar.ts';
export type { ProgressCircularOptions } from './display/ProgressCircular.ts';
export type { SkeletonOptions }         from './display/Skeleton.ts';
export type { SnackbarOptions }         from './display/Snackbar.ts';
export type { TagOptions }              from './display/Tag.ts';
export type { TooltipOptions }          from './display/Tooltip.ts';

// Charts
export { BarChart,  BarChartCSS }  from './charts/BarChart.ts';
export { LineChart, LineChartCSS } from './charts/LineChart.ts';
export { PieChart,  PieChartCSS }  from './charts/PieChart.ts';
export type { BarDataPoint, BarChartOptions }   from './charts/BarChart.ts';
export type { LineDataPoint, LineChartOptions } from './charts/LineChart.ts';
export type { PieDataPoint, PieChartOptions }   from './charts/PieChart.ts';

/**
 * Inject all control CSS at once.
 * Call once at application startup.
 *
 * @example
 *   import { injectAllCSS } from 'arianna-wip/controls';
 *   injectAllCSS();
 */
export function injectAllCSS(): void {
  if (document.getElementById('arianna-wip-controls-css')) return;

  // Import all CSS strings lazily to avoid bundler issues
  // Each control exports a *CSS const — collect here
  const modules = [
    { AccordionCSS: null }, // populated at runtime via dynamic import or direct usage
  ];

  // Simpler: let each control inject on demand, or call this helper
  // which inlines everything from the exported CSS consts.
  // Users can also import individual *CSS consts and add to a <style> tag.
  console.warn('[AriannA] injectAllCSS: call Theme.inject() for base styles, then import and inject individual *CSS consts as needed.');
}
