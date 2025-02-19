import path from 'path';
import { Beatmap, Calculator } from 'rosu-pp';
import { Process } from 'tsprocess/dist/process';

import { Leaderboard } from '@/Instances/Leaderboard';
import { DataRepo } from '@/Services/repo';
import { calculateGrade } from '@/Utils/calculateGrade';
import { OsuMods } from '@/Utils/osuMods.types';
import { resolvePassedObjects } from '@/Utils/resolvePassedObjects';
import { config } from '@/config';
import { wLogger } from '@/logger';

import { MenuData } from '../MenuData';
import { AbstractEntity } from '../types';

export interface KeyOverlay {
    K1Pressed: boolean;
    K1Count: number;
    K2Pressed: boolean;
    K2Count: number;
    M1Pressed: boolean;
    M1Count: number;
    M2Pressed: boolean;
    M2Count: number;
}

export class GamePlayData extends AbstractEntity {
    isDefaultState: boolean = true;

    Retries: number;
    PlayerName: string;
    Mods: OsuMods;
    HitErrors: number[];
    Mode: number;
    MaxCombo: number;
    Score: number;
    Hit100: number;
    Hit300: number;
    Hit50: number;
    HitGeki: number;
    HitKatu: number;
    HitMiss: number;
    HitMissPrev: number;
    HitUR: number;
    HitSB: number;
    ComboPrev: number;
    Combo: number;
    PlayerHPSmooth: number;
    PlayerHP: number;
    Accuracy: number;
    UnstableRate: number;
    GradeCurrent: string;
    GradeExpected: string;
    Leaderboard?: Leaderboard;
    KeyOverlay: KeyOverlay;
    isReplayUiHidden: boolean;

    constructor(services: DataRepo) {
        super(services);

        this.init();
    }

    init(isRetry?: boolean) {
        wLogger.debug(`[GameplayData:init] reseting (retry:${isRetry})`);

        this.HitErrors = [];
        this.MaxCombo = 0;
        this.Score = 0;
        this.Hit100 = 0;
        this.Hit300 = 0;
        this.Hit50 = 0;
        this.HitGeki = 0;
        this.HitKatu = 0;
        this.HitMiss = 0;
        this.HitMissPrev = 0;
        this.HitUR = 0.0;
        this.HitSB = 0;
        this.ComboPrev = 0;
        this.Combo = 0;
        this.PlayerHPSmooth = 0.0;
        this.PlayerHP = 0.0;
        this.Accuracy = 0.0;
        this.UnstableRate = 0;
        this.GradeCurrent = '';
        this.GradeExpected = '';
        this.KeyOverlay = {
            K1Pressed: false,
            K1Count: 0,
            K2Pressed: false,
            K2Count: 0,
            M1Pressed: false,
            M1Count: 0,
            M2Pressed: false,
            M2Count: 0
        };
        this.isReplayUiHidden = false;

        // below is gata that shouldn't be reseted on retry
        if (isRetry == true) {
            return;
        }

        this.isDefaultState = true;
        this.Retries = 0;
        this.PlayerName = '';
        this.Mode = 0;
        this.Mods = 0;
        this.Leaderboard = undefined;
    }

    async updateState() {
        wLogger.debug(`[GamePlayData:updateState] starting`);

        const { process, bases, allTimesData, menuData } =
            this.services.getServices([
                'process',
                'bases',
                'allTimesData',
                'menuData'
            ]);

        const { baseAddr, rulesetsAddr } = bases.bases;

        const rulesetAddr = process.readInt(
            process.readInt(rulesetsAddr - 0xb) + 0x4
        );
        if (rulesetAddr === 0) {
            wLogger.debug('RulesetAddr is 0');
            return;
        }

        const gameplayBase = process.readInt(rulesetAddr + 0x68);
        const scoreBase = process.readInt(gameplayBase + 0x38);

        // Resetting default state value, to define other componenets that we have touched gamePlayData
        // needed for ex like you done with replay watching/gameplay and return to mainMenu, you need alteast one reset to gamePlayData/resultsScreenData
        this.isDefaultState = false;

        if (allTimesData.IsWatchingReplay) {
            // rulesetAddr mean ReplayWatcher... Sooo....
            // Ruleset + 0x1D4
            this.isReplayUiHidden = Boolean(
                process.readByte(rulesetAddr + 0x1d4)
            );
        } else {
            this.isReplayUiHidden = false;
        }

        // [Base - 0x33] + 0x8
        this.Retries = process.readInt(process.readInt(baseAddr - 0x33) + 0x8);
        // [[[Ruleset + 0x68] + 0x38] + 0x28]
        this.PlayerName = process.readSharpString(
            process.readInt(process.readInt(gameplayBase + 0x38) + 0x28)
        );
        // [[[Ruleset + 0x68] + 0x38] + 0x1C] + 0xC ^ [[[Ruleset + 0x68] + 0x38] + 0x1C] + 0x8
        this.Mods =
            process.readInt(process.readInt(scoreBase + 0x1c) + 0xc) ^
            process.readInt(process.readInt(scoreBase + 0x1c) + 0x8);
        // [[Ruleset + 0x68] + 0x38] + 0x64
        this.Mode = process.readInt(scoreBase + 0x64);
        // [[Ruleset + 0x68] + 0x38] + 0x68
        this.MaxCombo = process.readShort(scoreBase + 0x68);
        // [[Ruleset + 0x68] + 0x38] + 0x78
        this.Score = process.readInt(rulesetAddr + 0x100);
        // [[Ruleset + 0x68] + 0x38] + 0x88
        this.Hit100 = process.readShort(scoreBase + 0x88);
        // [[Ruleset + 0x68] + 0x38] + 0x8A
        this.Hit300 = process.readShort(scoreBase + 0x8a);
        // [[Ruleset + 0x68] + 0x38] + 0x8C
        this.Hit50 = process.readShort(scoreBase + 0x8c);
        // [[Ruleset + 0x68] + 0x38] + 0x8E
        this.HitGeki = process.readShort(scoreBase + 0x8e);
        // [[Ruleset + 0x68] + 0x38] + 0x90
        this.HitKatu = process.readShort(scoreBase + 0x90);
        // [[Ruleset + 0x68] + 0x38] + 0x92
        this.HitMiss = process.readShort(scoreBase + 0x92);
        // [[Ruleset + 0x68] + 0x38] + 0x94
        this.Combo = process.readShort(scoreBase + 0x94);
        // [[Ruleset + 0x68] + 0x40] + 0x14
        this.PlayerHPSmooth = process.readDouble(
            process.readInt(gameplayBase + 0x40) + 0x14
        );
        // [[Ruleset + 0x68] + 0x40] + 0x1C
        this.PlayerHP = process.readDouble(
            process.readInt(gameplayBase + 0x40) + 0x1c
        );
        // [[Ruleset + 0x68] + 0x48] + 0xC
        this.Accuracy = process.readDouble(
            process.readInt(gameplayBase + 0x48) + 0xc
        );

        if (this.MaxCombo > 0) {
            const baseUR = this.calculateUR();
            if ((this.Mods & OsuMods.DoubleTime) === OsuMods.DoubleTime) {
                this.UnstableRate = baseUR / 1.5;
            } else if ((this.Mods & OsuMods.HalfTime) === OsuMods.HalfTime) {
                this.UnstableRate = baseUR * 1.33;
            } else {
                this.UnstableRate = baseUR;
            }
        }

        if (this.ComboPrev > this.MaxCombo) {
            this.ComboPrev = 0;
        }
        if (this.Combo < this.ComboPrev && this.HitMiss === this.HitMissPrev) {
            this.HitSB += 1;
        }
        this.HitMissPrev = this.HitMiss;
        this.ComboPrev = this.Combo;

        wLogger.debug(`[GamePlayData:updateState] updated`);

        // [[[Ruleset + 0x68] + 0x38] + 0x38]
        this.HitErrors = this.getHitErrors(
            process,
            bases.leaderStart,
            scoreBase
        );

        this.updateLeaderboard(process, bases.leaderStart, rulesetAddr);
        this.updateGrade(menuData);
        this.updateStarsAndPerformance();
    }

    async updateKeyOverlay() {
        wLogger.debug(`[GamePlayData:updateKeyOverlay] starting`);

        const { process, bases } = this.services.getServices([
            'process',
            'bases'
        ]);

        const rulesetAddr = process.readInt(
            process.readInt(bases.bases.rulesetsAddr - 0xb) + 0x4
        );
        if (rulesetAddr === 0) {
            return;
        }

        // [[Ruleset + 0xB0] + 0x10] + 0x4
        const keyOverlayArrayAddr = process.readInt(
            process.readInt(process.readInt(rulesetAddr + 0xb0) + 0x10) + 0x4
        );

        const keys = this.getKeyOverlay(process, keyOverlayArrayAddr);
        if (keys.K1Count < 0 || keys.K1Count > 1_000_000) {
            keys.K1Pressed = false;
            keys.K1Count = 0;
        }
        if (keys.K2Count < 0 || keys.K2Count > 1_000_000) {
            keys.K2Pressed = false;
            keys.K2Count = 0;
        }
        if (keys.M1Count < 0 || keys.M1Count > 1_000_000) {
            keys.M1Pressed = false;
            keys.M1Count = 0;
        }
        if (keys.M2Count < 0 || keys.M2Count > 1_000_000) {
            keys.M2Pressed = false;
            keys.M2Count = 0;
        }

        this.KeyOverlay = keys;

        wLogger.debug(
            `[GamePlayData:updateKeyOverlay] updated (${rulesetAddr} ${keyOverlayArrayAddr}) ${keys.K1Count}:${keys.K2Count}:${keys.M1Count}:${keys.M2Count}`
        );
    }

    private getKeyOverlay(process: Process, keyOverlayArrayAddr: number) {
        return {
            // [Base + 0x8] + 0x1C
            K1Pressed: Boolean(
                process.readByte(
                    process.readInt(keyOverlayArrayAddr + 0x8) + 0x1c
                )
            ),
            // [Base + 0x8] + 0x14
            K1Count: process.readInt(
                process.readInt(keyOverlayArrayAddr + 0x8) + 0x14
            ),
            // [Base + 0xC] + 0x1C
            K2Pressed: Boolean(
                process.readByte(
                    process.readInt(keyOverlayArrayAddr + 0xc) + 0x1c
                )
            ),
            // [Base + 0xC] + 0x14
            K2Count: process.readInt(
                process.readInt(keyOverlayArrayAddr + 0xc) + 0x14
            ),
            // [Base + 0x10] + 0x1C
            M1Pressed: Boolean(
                process.readByte(
                    process.readInt(keyOverlayArrayAddr + 0x10) + 0x1c
                )
            ),
            // [Base + 0x10] + 0x14
            M1Count: process.readInt(
                process.readInt(keyOverlayArrayAddr + 0x10) + 0x14
            ),
            // [Base + 0x14] + 0x1C
            M2Pressed: Boolean(
                process.readByte(
                    process.readInt(keyOverlayArrayAddr + 0x14) + 0x1c
                )
            ),
            // [Base + 0x14] + 0x14
            M2Count: process.readInt(
                process.readInt(keyOverlayArrayAddr + 0x14) + 0x14
            )
        };
    }

    private getHitErrors(
        process: Process,
        leaderStart: number,
        scoreBase: number = 0
    ): Array<number> {
        wLogger.debug(`[GamePlayData:getHitErrors] processing`);
        if (scoreBase === 0) return [];

        const errors: Array<number> = [];

        const base = process.readInt(scoreBase + 0x38);
        const items = process.readInt(base + 0x4);
        const size = process.readInt(base + 0xc);

        for (let i = 0; i < size; i++) {
            let current = items + leaderStart + 0x4 * i;
            let error = process.readInt(current);

            errors.push(error);
        }

        wLogger.debug(`[GamePlayData:getHitErrors] done`);

        return errors;
    }

    private calculateUR(): number {
        if (this.HitErrors.length < 1) {
            return 0;
        }

        let totalAll = 0.0;
        for (const hit of this.HitErrors) {
            totalAll += hit;
        }

        const average = totalAll / this.HitErrors.length;
        let variance = 0;
        for (const hit of this.HitErrors) {
            variance += Math.pow(hit - average, 2);
        }
        variance = variance / this.HitErrors.length;

        return Math.sqrt(variance) * 10;
    }

    private updateGrade(menuData: MenuData) {
        wLogger.debug(`[GamePlayData:updateGrade] processing`);

        const remaining =
            menuData.ObjectCount -
            this.Hit300 -
            this.Hit100 -
            this.Hit50 -
            this.HitMiss;

        this.GradeCurrent = calculateGrade(
            this.Mode,
            this.Mods,
            this.Hit300,
            this.Hit100,
            this.Hit50,
            this.HitMiss,
            this.Accuracy
        );
        this.GradeExpected = calculateGrade(
            this.Mode,
            this.Mods,
            this.Hit300 + remaining,
            this.Hit100,
            this.Hit50,
            this.HitMiss,
            this.Accuracy
        );
    }

    private updateLeaderboard(
        process: Process,
        leaderStart: number,
        rulesetAddr: number
    ) {
        wLogger.debug(`[GamePlayData:updateLeaderboard] processing`);
        // [Ruleset + 0x7C]
        const leaderBoardBase = process.readInt(rulesetAddr + 0x7c);

        // [Ruleset + 0x7C] + 0x24
        const leaderBoardAddr =
            leaderBoardBase > 0 ? process.readInt(leaderBoardBase + 0x24) : 0;
        if (!this.Leaderboard) {
            this.Leaderboard = new Leaderboard(process, leaderBoardAddr);
        } else {
            this.Leaderboard.updateBase(leaderBoardAddr);
        }
        this.Leaderboard.readLeaderboard(leaderStart);
    }

    private updateStarsAndPerformance() {
        wLogger.debug(`[GamePlayData:updateStarsAndPerformance] starting`);
        if (!config.calculatePP) {
            wLogger.debug(
                `[GamePlayData:updateStarsAndPerformance] pp calculation disabled`
            );
            return;
        }

        const { settings, menuData, beatmapPpData } = this.services.getServices(
            ['settings', 'menuData', 'beatmapPpData']
        );

        if (!settings.gameFolder) {
            wLogger.debug(
                `[GamePlayData:updateStarsAndPerformance] game folder not found`
            );
            return;
        }

        const mapPath = path.join(
            settings.songsFolder,
            menuData.Folder,
            menuData.Path
        );
        let beatmap;
        try {
            beatmap = new Beatmap({
                path: mapPath,
                ar: menuData.AR,
                od: menuData.OD,
                cs: menuData.CS,
                hp: menuData.HP
            });
        } catch (e) {
            wLogger.debug("can't get map");
            return;
        }

        const scoreParams = {
            passedObjects: resolvePassedObjects(
                this.Mode,
                this.Hit300,
                this.Hit100,
                this.Hit50,
                this.HitMiss,
                this.HitKatu,
                this.HitGeki
            ),
            combo: this.MaxCombo,
            mods: this.Mods,
            nMisses: this.HitMiss,
            n50: this.Hit50,
            n100: this.Hit100,
            n300: this.Hit300
        };

        const curPerformance = new Calculator(scoreParams).performance(beatmap);
        const fcPerformance = new Calculator({
            mods: this.Mods,
            nMisses: this.HitMiss,
            n50: this.Hit50,
            n100: this.Hit100,
            n300: this.Hit300
        }).performance(beatmap);

        beatmapPpData.updateCurrentAttributes(
            curPerformance.difficulty.stars,
            curPerformance.pp
        );
        beatmapPpData.updateFcPP(fcPerformance.pp);

        wLogger.debug(`[GamePlayData:updateStarsAndPerformance] updated`);
    }
}
