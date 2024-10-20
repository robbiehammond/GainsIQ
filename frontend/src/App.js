"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const WorkoutTracker_1 = __importDefault(require("./WorkoutTracker"));
const LastMonthWorkouts_1 = __importDefault(require("./LastMonthWorkouts"));
const material_1 = require("@mui/material");
const colors_1 = require("@mui/material/colors");
// Custom theme
const theme = (0, material_1.createTheme)({
    palette: {
        primary: {
            main: colors_1.indigo[500],
        },
        secondary: {
            main: colors_1.amber[500],
        },
        background: {
            default: colors_1.teal[50],
        },
    },
    typography: {
        h4: {
            fontWeight: 'bold',
            color: colors_1.indigo[700],
        },
        h5: {
            color: colors_1.amber[800],
        },
    },
});
const App = () => {
    const [currentPage, setCurrentPage] = (0, react_1.useState)('tracker');
    // Function to handle navigation
    const handleNavigation = (page) => {
        setCurrentPage(page);
    };
    return (react_1.default.createElement(material_1.ThemeProvider, { theme: theme },
        react_1.default.createElement(material_1.Container, { maxWidth: "md", sx: { padding: '40px 20px' } }, currentPage === 'tracker' ? (react_1.default.createElement(react_1.default.Fragment, null,
            react_1.default.createElement(WorkoutTracker_1.default, null),
            react_1.default.createElement(material_1.Button, { variant: "contained", color: "secondary", fullWidth: true, sx: { marginTop: 2 }, onClick: () => handleNavigation('lastMonth') }, "View Last Month's Workouts"))) : (react_1.default.createElement(react_1.default.Fragment, null,
            react_1.default.createElement(LastMonthWorkouts_1.default, null),
            react_1.default.createElement(material_1.Button, { variant: "contained", color: "primary", fullWidth: true, sx: { marginTop: 2 }, onClick: () => handleNavigation('tracker') }, "Back to Workout Tracker"))))));
};
exports.default = App;
//# sourceMappingURL=App.js.map