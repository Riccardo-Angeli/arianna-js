"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RangeSliderCSS = exports.RangeSlider = exports.RadioCSS = exports.Radio = exports.FileUploadCSS = exports.FileUpload = exports.DropdownCSS = exports.Dropdown = exports.DatePickerCSS = exports.DatePicker = exports.ColorPickerCSS = exports.ColorPicker = exports.ChipCSS = exports.Chip = exports.CheckboxCSS = exports.Checkbox = exports.ButtonCSS = exports.Button = exports.StepperCSS = exports.Stepper = exports.PaginationCSS = exports.Pagination = exports.NavRailCSS = exports.NavRail = exports.MenuCSS = exports.Menu = exports.HeaderCSS = exports.Header = exports.BreadcrumbCSS = exports.Breadcrumb = exports.TabsCSS = exports.Tabs = exports.SplitterCSS = exports.Splitter = exports.PanelCSS = exports.Panel = exports.ModalCSS = exports.Modal = exports.DrawerCSS = exports.Drawer = exports.CardCSS = exports.Card = exports.AccordionCSS = exports.Accordion = exports.TableCSS = exports.Table = exports.TreeViewCSS = exports.TreeView = exports.AriannATheme = exports.AriannAControl = void 0;
exports.PieChartCSS = exports.PieChart = exports.LineChartCSS = exports.LineChart = exports.BarChartCSS = exports.BarChart = exports.TooltipCSS = exports.Tooltip = exports.TagCSS = exports.Tag = exports.SnackbarCSS = exports.Snackbar = exports.SkeletonCSS = exports.Skeleton = exports.ProgressCircularCSS = exports.ProgressCircular = exports.ProgressBarCSS = exports.ProgressBar = exports.ListCSS = exports.List = exports.IconCSS = exports.Icon = exports.DividerCSS = exports.Divider = exports.BannerCSS = exports.Banner = exports.BadgeCSS = exports.Badge = exports.AvatarCSS = exports.Avatar = exports.TimePickerCSS = exports.TimePicker = exports.TextFieldCSS = exports.TextField = exports.SwitchCSS = exports.Switch = exports.SearchBarCSS = exports.SearchBar = exports.RatingCSS = exports.Rating = void 0;
exports.injectAllCSS = injectAllCSS;
// Core
var AriannAControl_ts_1 = require("./core/Control.ts");
Object.defineProperty(exports, "AriannAControl", { enumerable: true, get: function () { return AriannAControl_ts_1.Control; } });
var AriannATheme_ts_1 = require("./core/Theme.ts");
Object.defineProperty(exports, "AriannATheme", { enumerable: true, get: function () { return AriannATheme_ts_1.Theme; } });
// Data
var TreeView_ts_1 = require("./TreeView.ts");
Object.defineProperty(exports, "TreeView", { enumerable: true, get: function () { return TreeView_ts_1.TreeView; } });
Object.defineProperty(exports, "TreeViewCSS", { enumerable: true, get: function () { return TreeView_ts_1.TreeViewCSS; } });
var Table_ts_1 = require("./Table.ts");
Object.defineProperty(exports, "Table", { enumerable: true, get: function () { return Table_ts_1.Table; } });
Object.defineProperty(exports, "TableCSS", { enumerable: true, get: function () { return Table_ts_1.TableCSS; } });
// Layout
var Accordion_ts_1 = require("./layout/Accordion.ts");
Object.defineProperty(exports, "Accordion", { enumerable: true, get: function () { return Accordion_ts_1.Accordion; } });
Object.defineProperty(exports, "AccordionCSS", { enumerable: true, get: function () { return Accordion_ts_1.AccordionCSS; } });
var Card_ts_1 = require("./layout/Card.ts");
Object.defineProperty(exports, "Card", { enumerable: true, get: function () { return Card_ts_1.Card; } });
Object.defineProperty(exports, "CardCSS", { enumerable: true, get: function () { return Card_ts_1.CardCSS; } });
var Drawer_ts_1 = require("./layout/Drawer.ts");
Object.defineProperty(exports, "Drawer", { enumerable: true, get: function () { return Drawer_ts_1.Drawer; } });
Object.defineProperty(exports, "DrawerCSS", { enumerable: true, get: function () { return Drawer_ts_1.DrawerCSS; } });
var Modal_ts_1 = require("./layout/Modal.ts");
Object.defineProperty(exports, "Modal", { enumerable: true, get: function () { return Modal_ts_1.Modal; } });
Object.defineProperty(exports, "ModalCSS", { enumerable: true, get: function () { return Modal_ts_1.ModalCSS; } });
var Panel_ts_1 = require("./layout/Panel.ts");
Object.defineProperty(exports, "Panel", { enumerable: true, get: function () { return Panel_ts_1.Panel; } });
Object.defineProperty(exports, "PanelCSS", { enumerable: true, get: function () { return Panel_ts_1.PanelCSS; } });
var Splitter_ts_1 = require("./layout/Splitter.ts");
Object.defineProperty(exports, "Splitter", { enumerable: true, get: function () { return Splitter_ts_1.Splitter; } });
Object.defineProperty(exports, "SplitterCSS", { enumerable: true, get: function () { return Splitter_ts_1.SplitterCSS; } });
var Tabs_ts_1 = require("./layout/Tabs.ts");
Object.defineProperty(exports, "Tabs", { enumerable: true, get: function () { return Tabs_ts_1.Tabs; } });
Object.defineProperty(exports, "TabsCSS", { enumerable: true, get: function () { return Tabs_ts_1.TabsCSS; } });
// Navigation
var Breadcrumb_ts_1 = require("./navigation/Breadcrumb.ts");
Object.defineProperty(exports, "Breadcrumb", { enumerable: true, get: function () { return Breadcrumb_ts_1.Breadcrumb; } });
Object.defineProperty(exports, "BreadcrumbCSS", { enumerable: true, get: function () { return Breadcrumb_ts_1.BreadcrumbCSS; } });
var Header_ts_1 = require("./navigation/Header.ts");
Object.defineProperty(exports, "Header", { enumerable: true, get: function () { return Header_ts_1.Header; } });
Object.defineProperty(exports, "HeaderCSS", { enumerable: true, get: function () { return Header_ts_1.HeaderCSS; } });
var Menu_ts_1 = require("./navigation/Menu.ts");
Object.defineProperty(exports, "Menu", { enumerable: true, get: function () { return Menu_ts_1.Menu; } });
Object.defineProperty(exports, "MenuCSS", { enumerable: true, get: function () { return Menu_ts_1.MenuCSS; } });
var NavRail_ts_1 = require("./navigation/NavRail.ts");
Object.defineProperty(exports, "NavRail", { enumerable: true, get: function () { return NavRail_ts_1.NavRail; } });
Object.defineProperty(exports, "NavRailCSS", { enumerable: true, get: function () { return NavRail_ts_1.NavRailCSS; } });
var Pagination_ts_1 = require("./navigation/Pagination.ts");
Object.defineProperty(exports, "Pagination", { enumerable: true, get: function () { return Pagination_ts_1.Pagination; } });
Object.defineProperty(exports, "PaginationCSS", { enumerable: true, get: function () { return Pagination_ts_1.PaginationCSS; } });
var Stepper_ts_1 = require("./navigation/Stepper.ts");
Object.defineProperty(exports, "Stepper", { enumerable: true, get: function () { return Stepper_ts_1.Stepper; } });
Object.defineProperty(exports, "StepperCSS", { enumerable: true, get: function () { return Stepper_ts_1.StepperCSS; } });
// Inputs
var Button_ts_1 = require("./inputs/Button.ts");
Object.defineProperty(exports, "Button", { enumerable: true, get: function () { return Button_ts_1.Button; } });
Object.defineProperty(exports, "ButtonCSS", { enumerable: true, get: function () { return Button_ts_1.ButtonCSS; } });
var Checkbox_ts_1 = require("./inputs/Checkbox.ts");
Object.defineProperty(exports, "Checkbox", { enumerable: true, get: function () { return Checkbox_ts_1.Checkbox; } });
Object.defineProperty(exports, "CheckboxCSS", { enumerable: true, get: function () { return Checkbox_ts_1.CheckboxCSS; } });
var Chip_ts_1 = require("./inputs/Chip.ts");
Object.defineProperty(exports, "Chip", { enumerable: true, get: function () { return Chip_ts_1.Chip; } });
Object.defineProperty(exports, "ChipCSS", { enumerable: true, get: function () { return Chip_ts_1.ChipCSS; } });
var ColorPicker_ts_1 = require("./inputs/ColorPicker.ts");
Object.defineProperty(exports, "ColorPicker", { enumerable: true, get: function () { return ColorPicker_ts_1.ColorPicker; } });
Object.defineProperty(exports, "ColorPickerCSS", { enumerable: true, get: function () { return ColorPicker_ts_1.ColorPickerCSS; } });
var DatePicker_ts_1 = require("./inputs/DatePicker.ts");
Object.defineProperty(exports, "DatePicker", { enumerable: true, get: function () { return DatePicker_ts_1.DatePicker; } });
Object.defineProperty(exports, "DatePickerCSS", { enumerable: true, get: function () { return DatePicker_ts_1.DatePickerCSS; } });
var Dropdown_ts_1 = require("./inputs/Dropdown.ts");
Object.defineProperty(exports, "Dropdown", { enumerable: true, get: function () { return Dropdown_ts_1.Dropdown; } });
Object.defineProperty(exports, "DropdownCSS", { enumerable: true, get: function () { return Dropdown_ts_1.DropdownCSS; } });
var FileUpload_ts_1 = require("./inputs/FileUpload.ts");
Object.defineProperty(exports, "FileUpload", { enumerable: true, get: function () { return FileUpload_ts_1.FileUpload; } });
Object.defineProperty(exports, "FileUploadCSS", { enumerable: true, get: function () { return FileUpload_ts_1.FileUploadCSS; } });
var Radio_ts_1 = require("./inputs/Radio.ts");
Object.defineProperty(exports, "Radio", { enumerable: true, get: function () { return Radio_ts_1.Radio; } });
Object.defineProperty(exports, "RadioCSS", { enumerable: true, get: function () { return Radio_ts_1.RadioCSS; } });
var RangeSlider_ts_1 = require("./inputs/RangeSlider.ts");
Object.defineProperty(exports, "RangeSlider", { enumerable: true, get: function () { return RangeSlider_ts_1.RangeSlider; } });
Object.defineProperty(exports, "RangeSliderCSS", { enumerable: true, get: function () { return RangeSlider_ts_1.RangeSliderCSS; } });
var Rating_ts_1 = require("./inputs/Rating.ts");
Object.defineProperty(exports, "Rating", { enumerable: true, get: function () { return Rating_ts_1.Rating; } });
Object.defineProperty(exports, "RatingCSS", { enumerable: true, get: function () { return Rating_ts_1.RatingCSS; } });
var SearchBar_ts_1 = require("./inputs/SearchBar.ts");
Object.defineProperty(exports, "SearchBar", { enumerable: true, get: function () { return SearchBar_ts_1.SearchBar; } });
Object.defineProperty(exports, "SearchBarCSS", { enumerable: true, get: function () { return SearchBar_ts_1.SearchBarCSS; } });
var Switch_ts_1 = require("./inputs/Switch.ts");
Object.defineProperty(exports, "Switch", { enumerable: true, get: function () { return Switch_ts_1.Switch; } });
Object.defineProperty(exports, "SwitchCSS", { enumerable: true, get: function () { return Switch_ts_1.SwitchCSS; } });
var TextField_ts_1 = require("./inputs/TextField.ts");
Object.defineProperty(exports, "TextField", { enumerable: true, get: function () { return TextField_ts_1.TextField; } });
Object.defineProperty(exports, "TextFieldCSS", { enumerable: true, get: function () { return TextField_ts_1.TextFieldCSS; } });
var TimePicker_ts_1 = require("./inputs/TimePicker.ts");
Object.defineProperty(exports, "TimePicker", { enumerable: true, get: function () { return TimePicker_ts_1.TimePicker; } });
Object.defineProperty(exports, "TimePickerCSS", { enumerable: true, get: function () { return TimePicker_ts_1.TimePickerCSS; } });
// Display
var Avatar_ts_1 = require("./display/Avatar.ts");
Object.defineProperty(exports, "Avatar", { enumerable: true, get: function () { return Avatar_ts_1.Avatar; } });
Object.defineProperty(exports, "AvatarCSS", { enumerable: true, get: function () { return Avatar_ts_1.AvatarCSS; } });
var Badge_ts_1 = require("./display/Badge.ts");
Object.defineProperty(exports, "Badge", { enumerable: true, get: function () { return Badge_ts_1.Badge; } });
Object.defineProperty(exports, "BadgeCSS", { enumerable: true, get: function () { return Badge_ts_1.BadgeCSS; } });
var Banner_ts_1 = require("./display/Banner.ts");
Object.defineProperty(exports, "Banner", { enumerable: true, get: function () { return Banner_ts_1.Banner; } });
Object.defineProperty(exports, "BannerCSS", { enumerable: true, get: function () { return Banner_ts_1.BannerCSS; } });
var Divider_ts_1 = require("./display/Divider.ts");
Object.defineProperty(exports, "Divider", { enumerable: true, get: function () { return Divider_ts_1.Divider; } });
Object.defineProperty(exports, "DividerCSS", { enumerable: true, get: function () { return Divider_ts_1.DividerCSS; } });
var Icon_ts_1 = require("./display/Icon.ts");
Object.defineProperty(exports, "Icon", { enumerable: true, get: function () { return Icon_ts_1.Icon; } });
Object.defineProperty(exports, "IconCSS", { enumerable: true, get: function () { return Icon_ts_1.IconCSS; } });
var List_ts_1 = require("./display/List.ts");
Object.defineProperty(exports, "List", { enumerable: true, get: function () { return List_ts_1.List; } });
Object.defineProperty(exports, "ListCSS", { enumerable: true, get: function () { return List_ts_1.ListCSS; } });
var ProgressBar_ts_1 = require("./display/ProgressBar.ts");
Object.defineProperty(exports, "ProgressBar", { enumerable: true, get: function () { return ProgressBar_ts_1.ProgressBar; } });
Object.defineProperty(exports, "ProgressBarCSS", { enumerable: true, get: function () { return ProgressBar_ts_1.ProgressBarCSS; } });
var ProgressCircular_ts_1 = require("./display/ProgressCircular.ts");
Object.defineProperty(exports, "ProgressCircular", { enumerable: true, get: function () { return ProgressCircular_ts_1.ProgressCircular; } });
Object.defineProperty(exports, "ProgressCircularCSS", { enumerable: true, get: function () { return ProgressCircular_ts_1.ProgressCircularCSS; } });
var Skeleton_ts_1 = require("./display/Skeleton.ts");
Object.defineProperty(exports, "Skeleton", { enumerable: true, get: function () { return Skeleton_ts_1.Skeleton; } });
Object.defineProperty(exports, "SkeletonCSS", { enumerable: true, get: function () { return Skeleton_ts_1.SkeletonCSS; } });
var Snackbar_ts_1 = require("./display/Snackbar.ts");
Object.defineProperty(exports, "Snackbar", { enumerable: true, get: function () { return Snackbar_ts_1.Snackbar; } });
Object.defineProperty(exports, "SnackbarCSS", { enumerable: true, get: function () { return Snackbar_ts_1.SnackbarCSS; } });
var Tag_ts_1 = require("./display/Tag.ts");
Object.defineProperty(exports, "Tag", { enumerable: true, get: function () { return Tag_ts_1.Tag; } });
Object.defineProperty(exports, "TagCSS", { enumerable: true, get: function () { return Tag_ts_1.TagCSS; } });
var Tooltip_ts_1 = require("./display/Tooltip.ts");
Object.defineProperty(exports, "Tooltip", { enumerable: true, get: function () { return Tooltip_ts_1.Tooltip; } });
Object.defineProperty(exports, "TooltipCSS", { enumerable: true, get: function () { return Tooltip_ts_1.TooltipCSS; } });
// Charts
var BarChart_ts_1 = require("./charts/BarChart.ts");
Object.defineProperty(exports, "BarChart", { enumerable: true, get: function () { return BarChart_ts_1.BarChart; } });
Object.defineProperty(exports, "BarChartCSS", { enumerable: true, get: function () { return BarChart_ts_1.BarChartCSS; } });
var LineChart_ts_1 = require("./charts/LineChart.ts");
Object.defineProperty(exports, "LineChart", { enumerable: true, get: function () { return LineChart_ts_1.LineChart; } });
Object.defineProperty(exports, "LineChartCSS", { enumerable: true, get: function () { return LineChart_ts_1.LineChartCSS; } });
var PieChart_ts_1 = require("./charts/PieChart.ts");
Object.defineProperty(exports, "PieChart", { enumerable: true, get: function () { return PieChart_ts_1.PieChart; } });
Object.defineProperty(exports, "PieChartCSS", { enumerable: true, get: function () { return PieChart_ts_1.PieChartCSS; } });
/**
 * Inject all control CSS at once.
 * Call once at application startup.
 *
 * @example
 *   import { injectAllCSS } from 'arianna-wip/controls';
 *   injectAllCSS();
 */
function injectAllCSS() {
    if (document.getElementById('arianna-wip-controls-css'))
        return;
    // Import all CSS strings lazily to avoid bundler issues
    // Each control exports a *CSS const — collect here
    var modules = [
        { AccordionCSS: null }, // populated at runtime via dynamic import or direct usage
    ];
    // Simpler: let each control inject on demand, or call this helper
    // which inlines everything from the exported CSS consts.
    // Users can also import individual *CSS consts and add to a <style> tag.
    console.warn('[AriannA] injectAllCSS: call Theme.inject() for base styles, then import and inject individual *CSS consts as needed.');
}
