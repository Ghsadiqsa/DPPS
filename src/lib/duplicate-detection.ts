/**
 * DPPS Duplicate Detection Engine
 * 
 * Implements the business scoring formula from the Product Owner Business Guide:
 * Total Score = (Amount Match × 40%) + (Vendor Match × 30%) + (Invoice Pattern × 30%)
 * 
 * Signals:
 * - Exact Amount: Amounts match exactly
 * - Vendor Match: Same vendor ID
 * - Invoice Pattern (Fuzzy): Levenshtein similarity > 80%
 * - Date Proximity: Invoice dates within 7 days
 * - Fuzzy Amount: Amount difference < 0.5%
 */

// Configuration defaults (can be overridden by database config)
export const DEFAULT_CONFIG = {
    criticalThreshold: 85,
    highThreshold: 70,
    mediumThreshold: 50,
    invoicePatternTrigger: 0.80, // 80%
    dateProximityDays: 7,
    fuzzyAmountTolerance: 0.005, // 0.5%
    legalEntityScope: 'within' as 'within' | 'cross',
    reportingCurrency: 'USD',
    showSideBySideAmounts: false,
};

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface Signal {
    name: string;
    triggered: boolean;
    description: string;
    value?: string | number;
}

export interface DetectionResult {
    score: number;
    riskLevel: RiskLevel;
    autoHold: boolean;
    signals: Signal[];
    explanation: string;
    matchedInvoice: InvoiceData | null;
}

export interface InvoiceData {
    id?: string;
    invoiceNumber: string;
    vendorId: string;
    vendorName?: string;
    amount: number | string;
    invoiceDate: Date | string;
    legalEntity?: string;
    currency?: string;
    companyCode?: string;
    referenceNumber?: string;
}

export interface DetectionConfig {
    criticalThreshold: number;
    highThreshold: number;
    mediumThreshold: number;
    invoicePatternTrigger: number;
    dateProximityDays: number;
    fuzzyAmountTolerance: number;
    legalEntityScope: 'within' | 'cross';
    reportingCurrency: string;
    showSideBySideAmounts: boolean;
}

/**
 * Main detection function - compares two invoices and returns detection result
 */
export function detectDuplicate(
    currentInvoice: InvoiceData,
    candidateInvoice: InvoiceData,
    config: DetectionConfig = DEFAULT_CONFIG
): DetectionResult {
    const signals: Signal[] = [];
    let score = 0;

    // Parse amounts to numbers
    const amount1 = parseFloat(String(currentInvoice.amount));
    const amount2 = parseFloat(String(candidateInvoice.amount));

    // 1. Exact Amount Match (40 points)
    const exactAmountMatch = amount1 === amount2;
    if (exactAmountMatch) {
        score += 40;
    }
    signals.push({
        name: 'Exact Amount',
        triggered: exactAmountMatch,
        description: 'Amounts match exactly to the cent',
        value: exactAmountMatch ? `${amount1} = ${amount2}` : `${amount1} ≠ ${amount2}`,
    });

    // 2. Vendor Match (30 points)
    const vendorMatch = currentInvoice.vendorId === candidateInvoice.vendorId;
    if (vendorMatch) {
        score += 30;
    }
    signals.push({
        name: 'Vendor Match',
        triggered: vendorMatch,
        description: 'Same vendor ID',
        value: vendorMatch ? currentInvoice.vendorId : undefined,
    });

    // 3. Invoice Pattern - Levenshtein similarity (up to 30 points)
    const invoiceSimilarity = levenshteinSimilarity(
        currentInvoice.invoiceNumber,
        candidateInvoice.invoiceNumber
    );
    const invoicePoints = invoiceSimilarity * 30;
    score += invoicePoints;

    const patternTriggered = invoiceSimilarity > config.invoicePatternTrigger;
    signals.push({
        name: 'Invoice Pattern (Fuzzy)',
        triggered: patternTriggered,
        description: `Invoice similarity > ${config.invoicePatternTrigger * 100}%`,
        value: `${(invoiceSimilarity * 100).toFixed(1)}%`,
    });

    // 4. Date Proximity (Mathematical Contributor & Signal)
    const date1 = new Date(currentInvoice.invoiceDate);
    const date2 = new Date(candidateInvoice.invoiceDate);
    let daysDiff = 0;
    let dateProximityTriggered = false;

    if (!isNaN(date1.getTime()) && !isNaN(date2.getTime())) {
        daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
        dateProximityTriggered = daysDiff <= config.dateProximityDays;

        if (daysDiff === 0) {
            score += 10; // Exact same date adds 10 points
        } else if (dateProximityTriggered) {
            score += 5; // Close dates add 5 points
        }
    }

    signals.push({
        name: 'Date Proximity',
        triggered: dateProximityTriggered,
        description: `Invoice dates within ${config.dateProximityDays} days (+points applied)`,
        value: `${Math.round(daysDiff)} days apart`,
    });

    // 5. Fuzzy Amount (supplementary signal - for near-matches)
    const amountDiff = Math.abs(amount1 - amount2);
    const maxAmount = Math.max(amount1, amount2);
    const percentDiff = maxAmount > 0 ? amountDiff / maxAmount : 0;
    const fuzzyAmountTriggered = !exactAmountMatch && percentDiff < config.fuzzyAmountTolerance;
    signals.push({
        name: 'Fuzzy Amount',
        triggered: fuzzyAmountTriggered,
        description: `Amount difference < ${config.fuzzyAmountTolerance * 100}%`,
        value: `${(percentDiff * 100).toFixed(2)}% difference`,
    });

    // 6. Composite Key Match (Vendor + Company Code + Reference Number)
    const hasCompositeKeys = currentInvoice.companyCode && currentInvoice.referenceNumber &&
        candidateInvoice.companyCode && candidateInvoice.referenceNumber;

    const compositeMatch = hasCompositeKeys &&
        vendorMatch &&
        currentInvoice.companyCode === candidateInvoice.companyCode &&
        currentInvoice.referenceNumber === candidateInvoice.referenceNumber;

    if (compositeMatch) {
        // Boosting the score heavily if the exact ERP composite key matches another document
        score += 50;
    }
    signals.push({
        name: 'Composite Key Match',
        triggered: !!compositeMatch,
        description: 'Vendor, Company Code, and Reference Number match exactly',
        value: compositeMatch ? `${currentInvoice.vendorId}-${currentInvoice.companyCode}-${currentInvoice.referenceNumber}` : undefined,
    });

    // Calculate final score (capped at 100)
    const finalScore = Math.min(100, Math.round(score));

    // Determine risk level
    const riskLevel = classifyRisk(finalScore, config);

    // Determine if auto-hold applies
    const autoHold = finalScore >= config.criticalThreshold;

    // Generate explanation
    const triggeredSignals = signals.filter(s => s.triggered).map(s => s.name);
    const explanation = triggeredSignals.length > 0
        ? `Matched based on: ${triggeredSignals.join(', ')}.`
        : 'No significant matches found.';

    return {
        score: finalScore,
        riskLevel,
        autoHold,
        signals,
        explanation,
        matchedInvoice: candidateInvoice,
    };
}

/**
 * Classify risk based on score and thresholds
 */
export function classifyRisk(score: number, config: DetectionConfig = DEFAULT_CONFIG): RiskLevel {
    if (score >= config.criticalThreshold) return 'critical';
    if (score >= config.highThreshold) return 'high';
    if (score >= config.mediumThreshold) return 'medium';
    return 'low';
}

/**
 * Get display properties for risk level
 */
export function getRiskLevelDisplay(riskLevel: RiskLevel): {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    action: string;
} {
    switch (riskLevel) {
        case 'critical':
            return {
                label: 'Critical',
                color: 'text-red-700',
                bgColor: 'bg-red-50',
                borderColor: 'border-red-200',
                action: 'Auto-hold; immediate review required',
            };
        case 'high':
            return {
                label: 'High',
                color: 'text-orange-700',
                bgColor: 'bg-orange-50',
                borderColor: 'border-orange-200',
                action: 'Conditional review; analyst decision',
            };
        case 'medium':
            return {
                label: 'Medium',
                color: 'text-yellow-700',
                bgColor: 'bg-yellow-50',
                borderColor: 'border-yellow-200',
                action: 'Flag for awareness; allow override',
            };
        case 'low':
            return {
                label: 'Low',
                color: 'text-emerald-700',
                bgColor: 'bg-emerald-50',
                borderColor: 'border-emerald-200',
                action: 'Proceed with standard processing',
            };
    }
}

/**
 * Calculate Levenshtein similarity between two strings
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
    str1 = String(str1 || '');
    str2 = String(str2 || '');
    if (!str1 && !str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein edit distance
 */
export function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

/**
 * Compare invoice within a proposal (check for duplicates in same batch)
 */
export function detectDuplicatesInProposal(
    invoices: InvoiceData[],
    config: DetectionConfig = DEFAULT_CONFIG
): Map<number, DetectionResult[]> {
    const results = new Map<number, DetectionResult[]>();

    for (let i = 0; i < invoices.length; i++) {
        const duplicates: DetectionResult[] = [];

        for (let j = 0; j < invoices.length; j++) {
            if (i === j) continue;

            const result = detectDuplicate(invoices[i], invoices[j], config);
            if (result.score >= config.mediumThreshold) {
                duplicates.push(result);
            }
        }

        if (duplicates.length > 0) {
            results.set(i, duplicates);
        }
    }

    return results;
}
