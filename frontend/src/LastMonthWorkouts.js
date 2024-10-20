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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const material_1 = require("@mui/material");
const colors_1 = require("@mui/material/colors");
// Create a custom theme with more colors
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
const LastMonthWorkouts = () => {
    const apiUrl = process.env.REACT_APP_API_URL || '';
    const [workouts, setWorkouts] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        const fetchWorkouts = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const response = yield fetch(`${apiUrl}/workouts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'last_month_workouts' }),
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch last month workouts');
                }
                const data = yield response.json();
                setWorkouts(data || []);
                setLoading(false);
            }
            catch (error) {
                console.error('Error fetching last month workouts:', error);
                setWorkouts([]);
                setLoading(false);
            }
        });
        fetchWorkouts();
    }, [apiUrl]);
    return (react_1.default.createElement(material_1.ThemeProvider, { theme: theme },
        react_1.default.createElement(material_1.Container, { maxWidth: "md", sx: { padding: '40px 20px' } },
            react_1.default.createElement(material_1.Paper, { elevation: 3, sx: { padding: '20px', backgroundColor: theme.palette.background.default } },
                react_1.default.createElement(material_1.Typography, { variant: "h4", align: "center", gutterBottom: true }, "Last Month's Workouts"),
                loading ? (react_1.default.createElement(material_1.Grid, { container: true, justifyContent: "center" },
                    react_1.default.createElement(material_1.CircularProgress, null))) : (react_1.default.createElement(material_1.Grid, { container: true, spacing: 2 }, workouts.length > 0 ? (workouts.map((workout, index) => (react_1.default.createElement(material_1.Grid, { item: true, xs: 12, key: index },
                    react_1.default.createElement(material_1.Card, { sx: { backgroundColor: colors_1.amber[50] } },
                        react_1.default.createElement(material_1.CardContent, null,
                            react_1.default.createElement(material_1.Typography, { variant: "h6", gutterBottom: true },
                                "Exercise: ",
                                workout.exercise),
                            react_1.default.createElement(material_1.Typography, null,
                                "Sets: ",
                                workout.sets,
                                ", Reps: ",
                                workout.reps,
                                ", Weight: ",
                                workout.weight,
                                " lbs"),
                            react_1.default.createElement(material_1.Typography, null,
                                "Date: ",
                                new Date(parseInt(workout.timestamp) * 1000).toLocaleString()))))))) : (react_1.default.createElement(material_1.Typography, { variant: "h6", align: "center" }, "No workouts found."))))))));
};
exports.default = LastMonthWorkouts;
//# sourceMappingURL=LastMonthWorkouts.js.map