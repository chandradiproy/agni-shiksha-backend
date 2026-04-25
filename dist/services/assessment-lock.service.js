"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExamMutationBlock = exports.getTestSeriesMutationBlock = void 0;
const db_1 = __importDefault(require("../config/db"));
const isTestSeriesLiveNow = (testSeries, now = new Date()) => {
    if (!testSeries.is_active || !testSeries.is_published) {
        return false;
    }
    if (testSeries.available_from > now) {
        return false;
    }
    if (testSeries.available_until && testSeries.available_until < now) {
        return false;
    }
    return true;
};
const getTestSeriesMutationBlock = (testSeriesId, action) => __awaiter(void 0, void 0, void 0, function* () {
    const [testSeries, inProgressAttempts, totalAttempts] = yield db_1.default.$transaction([
        db_1.default.testSeries.findUnique({
            where: { id: testSeriesId },
            select: {
                id: true,
                is_active: true,
                is_published: true,
                available_from: true,
                available_until: true,
            },
        }),
        db_1.default.testAttempt.count({
            where: { test_series_id: testSeriesId, status: 'in_progress' },
        }),
        db_1.default.testAttempt.count({
            where: { test_series_id: testSeriesId },
        }),
    ]);
    if (!testSeries) {
        return { status: 404, error: 'Test Series not found' };
    }
    if (inProgressAttempts > 0) {
        return {
            status: 409,
            error: `Cannot ${action} while ${inProgressAttempts} student attempt(s) are currently in progress for this test series.`,
        };
    }
    if (action !== 'update this test series' && isTestSeriesLiveNow(testSeries)) {
        return {
            status: 409,
            error: `Cannot ${action} while this test series is live and available to students.`,
        };
    }
    if (action.includes('delete') && totalAttempts > 0) {
        return {
            status: 409,
            error: 'Cannot delete this test series because student attempt history already exists. Deactivate or archive it instead.',
        };
    }
    return null;
});
exports.getTestSeriesMutationBlock = getTestSeriesMutationBlock;
const getExamMutationBlock = (examId, action) => __awaiter(void 0, void 0, void 0, function* () {
    const exam = yield db_1.default.exam.findUnique({
        where: { id: examId },
        select: { id: true },
    });
    if (!exam) {
        return { status: 404, error: 'Exam not found' };
    }
    const now = new Date();
    const [liveTestSeriesCount, inProgressAttempts] = yield db_1.default.$transaction([
        db_1.default.testSeries.count({
            where: {
                exam_id: examId,
                is_active: true,
                is_published: true,
                available_from: { lte: now },
                OR: [
                    { available_until: null },
                    { available_until: { gte: now } },
                ],
            },
        }),
        db_1.default.testAttempt.count({
            where: {
                status: 'in_progress',
                test_series: {
                    exam_id: examId,
                },
            },
        }),
    ]);
    if (inProgressAttempts > 0) {
        return {
            status: 409,
            error: `Cannot ${action} while ${inProgressAttempts} student attempt(s) are in progress under this exam.`,
        };
    }
    if (liveTestSeriesCount > 0) {
        return {
            status: 409,
            error: `Cannot ${action} while ${liveTestSeriesCount} test series are live under this exam.`,
        };
    }
    return null;
});
exports.getExamMutationBlock = getExamMutationBlock;
