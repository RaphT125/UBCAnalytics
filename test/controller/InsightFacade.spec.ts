import {
	IInsightFacade,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError,
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";
import { clearDisk, getContentFromArchives, loadTestQuery } from "../TestUtil";
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

export interface ITestQuery {
	title?: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;

	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;
	let valid: string;
	let campus: string;
	//let invalidRoom: string;
	let invalidIndex: string;
	let invalidBuildings: string;
	before(async function () {
		// This block runs once and loads the datasets.
		sections = await getContentFromArchives("pair.zip");
		valid = await getContentFromArchives("valid.zip");
		campus = await getContentFromArchives("campus.zip");
		//invalidRoom = await getContentFromArchives("invalidRoom.zip");
		invalidIndex = await getContentFromArchives("noIndex.zip");
		invalidBuildings = await getContentFromArchives("noBuildings.zip");

		// Just in case there is anything hanging around from a previous run of the test suite
		await clearDisk();
	});

	describe("AddDataset", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});
		//good  inputs adding dataset
		it("should successfully add a dataset (first)", async function () {
			try {
				const result = await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				expect(result).to.deep.equal(["ubc"]);
			} catch (error) {
				expect.fail("An Error Should not have been thrown" + error);
			}
		});
		it("should successfully add a dataset (second)", async function () {
			try {
				const result = await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				expect(result).to.deep.equal(["ubc"]);
			} catch (error) {
				expect.fail("An Error Should not have been thrown" + error);
			}
		});
		it("should successfully add multiple dataset", async function () {
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				const result = await facade.addDataset("ubc2", sections, InsightDatasetKind.Sections);
				expect(result).to.deep.equal(["ubc", "ubc2"]);
			} catch (error) {
				expect.fail("An Error Should not have been thrown" + error);
			}
		});
		it("should successfully add  room", async function () {
			try {
				const result = await facade.addDataset("ubc", campus, InsightDatasetKind.Rooms);
				expect(result).to.deep.equal(["ubc"]);
			} catch (error) {
				expect.fail("An Error Should not have been thrown" + error);
			}
		});
		it("should successfully add  multiple room", async function () {
			try {
				await facade.addDataset("ubc", campus, InsightDatasetKind.Rooms);
				const result = await facade.addDataset("ubc2", campus, InsightDatasetKind.Rooms);
				expect(result).to.deep.equal(["ubc", "ubc2"]);
			} catch (error) {
				expect.fail("An Error Should not have been thrown" + error);
			}
		});
		//bad input dataset
		it("should reject repeats same id", async function () {
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("should unsuccessfully add a dataset due to invalid root ", async function () {
			try {
				const test = await getContentFromArchives("invalidroot1.zip");
				await facade.addDataset("ubc3", test, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("should unsuccessfully add a dataset due to incorrectly named root ", async function () {
			try {
				const test = await getContentFromArchives("invalidroot2.zip");
				await facade.addDataset("ubc3", test, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("should unsuccessfully add a dataset due to invalid Json brackets  ", async function () {
			try {
				const test = await getContentFromArchives("invalidjson.zip");
				await facade.addDataset("ubc3", test, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("should unsuccessfully add a dataset due to invalid Json apostrophe   ", async function () {
			try {
				const test = await getContentFromArchives("invalidjson2.zip");
				await facade.addDataset("ubc3", test, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		//good input id
		it("Should accept Id that contains whiteSpace right", async function () {
			const result = await facade.addDataset("ubc ", sections, InsightDatasetKind.Sections);
			return expect(result).to.deep.equal(["ubc "]);
		});
		it("Should accept Id that contains whiteSpace middle ", async function () {
			const result = await facade.addDataset("u bc", sections, InsightDatasetKind.Sections);
			return expect(result).to.deep.equal(["u bc"]);
		});
		it("Should accept Id that contains whiteSpace left", async function () {
			const result = await facade.addDataset(" ubc", sections, InsightDatasetKind.Sections);
			return expect(result).to.deep.equal([" ubc"]);
		});
		//bad inputs id
		it("Should reject Id that contains underscore right", async function () {
			try {
				await facade.addDataset("ubc_", sections, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("Should reject Id that contains underscore in middle", async function () {
			try {
				await facade.addDataset("ub_c", sections, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("Should reject Id that contains underscore in left", async function () {
			try {
				await facade.addDataset("_ubc", sections, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("Should reject Id that contains only underscore", async function () {
			try {
				await facade.addDataset("_", sections, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("Should reject Id that contains only whiteSpace add", async function () {
			try {
				await facade.addDataset("    ", sections, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("should reject with  an empty dataset id", async function () {
			try {
				await facade.addDataset("", sections, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		//bad input file
		it("Should reject invalid room", async function () {
			try {
				await facade.addDataset("ubc3", sections, InsightDatasetKind.Rooms);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("Should reject no buildings in room zip", async function () {
			try {
				await facade.addDataset("ubc3", invalidBuildings, InsightDatasetKind.Rooms);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("Should reject no index in room zip", async function () {
			try {
				await facade.addDataset("ubc3", invalidIndex, InsightDatasetKind.Rooms);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		// it("Should reject 2 table in room zip", async function () {
		// 	try {
		// 		await facade.addDataset("ubc3", invalidRoom, InsightDatasetKind.Rooms);
		// 		expect.fail("An Error Should have been thrown");
		// 	} catch (error) {
		// 		expect(error).to.be.instanceof(InsightError);
		// 	}
		// });

		it("Should reject fake zip file", async function () {
			try {
				await facade.addDataset("ubc3", "pretendToBeAZip", InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("should reject repeats diff zip file same id", async function () {
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				await facade.addDataset("ubc", valid, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("should fail, less then 1 valid section", async function () {
			try {
				const test = await getContentFromArchives("emptyinformation.zip");
				await facade.addDataset("ubc3", test, InsightDatasetKind.Sections);
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		// it("should fail, room has not been added", async function () {
		// 	try {
		// 		await facade.addDataset("ubc3", valid, InsightDatasetKind.Rooms);
		// 		expect.fail("An Error Should have been thrown");
		// 	} catch (error) {
		// 		expect(error).to.be.instanceof(InsightError);
		// 	}
		// });
	});

	describe("RemoveDataset", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});
		//accept removal
		it("should successfully remove a dataset ", async function () {
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				await facade.addDataset("ubc2", valid, InsightDatasetKind.Sections);
				const result = await facade.removeDataset("ubc2");
				expect(result).to.deep.equal("ubc2");
			} catch (error) {
				expect.fail("should not be thrown" + error);
			}
		});
		//rejected removal
		it("Should reject Id that contains no id removal", async function () {
			try {
				await facade.removeDataset("");
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("Should reject Id that contains only whiteSpace removal", async function () {
			try {
				await facade.removeDataset("      ");
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("Should reject Id that contains only any underScore", async function () {
			try {
				await facade.removeDataset("_");
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(InsightError);
			}
		});
		it("Should reject Id that contains id that hasn't been added ", async function () {
			try {
				await facade.removeDataset("ubc3");
				expect.fail("An Error Should have been thrown");
			} catch (error) {
				expect(error).to.be.instanceof(NotFoundError);
			}
		});
	});
	describe("PerformQuery", function () {
		/**
		 * Loads the TestQuery specified in the test name and asserts the behaviour of performQuery.
		 *
		 * Note: the 'this' parameter is automatically set by Mocha and contains information about the test.
		 */
		async function checkQuery(this: Mocha.Context): Promise<void> {
			if (!this.test) {
				throw new Error(
					"Invalid call to checkQuery." +
						"Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
						"Do not invoke the function directly."
				);
			}
			// Destructuring assignment to reduce property accesses
			const { input, expected, errorExpected } = await loadTestQuery(this.test.title);
			let result: InsightResult[] = []; // dummy value before being reassigned
			try {
				result = await facade.performQuery(input);

				expect(result).to.have.deep.members(expected);
				if (errorExpected) {
					expect.fail(`performQuery resolved when it should have rejected with ${expected}`);
				}
			} catch (err) {
				if (!errorExpected) {
					expect.fail(`performQuery threw unexpected error: ${err}`);
				}
				if (errorExpected) {
					if (expected === "ResultTooLargeError") {
						expect(err).to.be.instanceof(ResultTooLargeError);
					} else if (expected === "InsightError") {
						expect(err).to.be.instanceof(InsightError);
					} else {
						expect.fail("Unexpected error" + err);
					}
				}
			}
		}
		before(async function () {
			await clearDisk();
			facade = new InsightFacade();

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises: Promise<string[]>[] = [
				facade.addDataset("sections", sections, InsightDatasetKind.Sections),
				facade.addDataset("valid", valid, InsightDatasetKind.Sections),
			];

			try {
				await Promise.all(loadDatasetPromises);
			} catch (err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			}
		});

		after(async function () {
			await clearDisk();
		});

		// Examples demonstrating how to test performQuery using the JSON Test Queries.
		// The relative path to the query file must be given in square brackets.
		it("[valid/simple.json] SELECT dept, avg WHERE avg > 97", checkQuery);
		it("[valid/valid_5k.json] 5kTest", checkQuery);
		it("[valid/valid_wildcard_suffix.json] wildcard suffix", checkQuery);
		it("[valid/valid_wildcard_prefix.json] wildcard prefix", checkQuery);
		it("[valid/valid_wildcard_combined.json] Wildcard combined", checkQuery);
		it("[valid/valid_queryNotFound.json] Query not found", checkQuery);
		it("[valid/valid_and.json] valid and test", checkQuery);
		it("[valid/valid_or.json] valid or test", checkQuery);
		it("[valid/valid_not_test.json] valid not test", checkQuery);
		it("[valid/valid_equal_test.json] Valid Equal test", checkQuery);
		it("[invalid/invalid.json] Query missing WHERE", checkQuery);
		it("[invalid/invalid_empty_AND.json] invalid_empty_AND", checkQuery);
		it("[invalid/invalid_empty_OR.json] invalid_empty_OR", checkQuery);
		it("[invalid/invalid_too_large.json] with 5001 rows", checkQuery);
		it("[invalid/invalid_no_option.json] missing option", checkQuery);
		it("[invalid/invalid_order.json] order is wrong", checkQuery);
		it("[invalid/invalid_wildcard_middle.json] Wildcard in the middle of subject", checkQuery);
		it("[invalid/invalid_no_object.json], invalidObject", checkQuery);
		it("[invalid/invalid_no_data_sheet.json], No datasetFound", checkQuery);
		it("[invalid/invalid_query_id.json], invalid expected id type", checkQuery);
		it("[invalid/invalid_query_course.json], invalid expected course type", checkQuery);
		it("[invalid/invalid_query_title.json], invalid expected title type", checkQuery);
		it("[invalid/invalid_query_professor.json], invalid expected professor type", checkQuery);
		it("[invalid/invalid_query_subject.json], invalid expected subject type", checkQuery);
		it("[invalid/invalid_query_year.json], invalid expected year type", checkQuery);
		it("[invalid/invalid_query_avg.json], invalid expected avg type", checkQuery);
		it("[invalid/invalid_query_pass.json], invalid expected pass type", checkQuery);
		it("[invalid/invalid_query_fail.json], invalid expected fail type", checkQuery);
		it("[invalid/invalid_query_audit.json], invalid expected audit type", checkQuery);
		it("[invalid/invalid_column.json], invalid column not array", checkQuery);
		it("[invalid/invalid_empty_column.json], invalid empty column", checkQuery);
		it("[invalid/invalid_query_key.json], invalid key", checkQuery);
		it("[invalid/invalid_query_idString.json], invalid id character", checkQuery);
		it("[invalid/invalid_multi_ref.json], invalid multiple referenced dataset", checkQuery);
		it("[invalid/invalid_order_type.json], invalid type for order", checkQuery);
		it("[invalid/invalid_no_option.json], missing option", checkQuery);
		it("[invalid/invalid_empty_is.json], empty is", checkQuery);
		it("[invalid/invalid_empty_not.json], empty not", checkQuery);
		it("[invalid/invalid_multi_ref2.json],invalid multiple referenced dataset 2", checkQuery);
		//it("[invalid_not_test.json], invalid not test", checkQuery);
		//it("[invalid_missing_options.json], Missing options", checkQuery);
	});
	describe("listDatasets", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});
		it("should have nothing", async function () {
			const result = await facade.listDatasets();
			expect(result.length).to.deep.equal(0);
		});
		it("should have 1", async function () {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			expect(result.length).to.deep.equal(1);
			expect(result[0].id).to.deep.equal("ubc");
		});
		it("should have 2", async function () {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			await facade.addDataset("ubc2", valid, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			expect(result.length).to.deep.equal(2);
			expect(result[0].id).to.deep.equal("ubc");
			expect(result[1].id).to.deep.equal("ubc2");
		});
		it("should have 3", async function () {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			await facade.addDataset("ubc2", valid, InsightDatasetKind.Sections);
			await facade.addDataset("ubc3", campus, InsightDatasetKind.Rooms);
			const result = await facade.listDatasets();
			expect(result.length).to.deep.equal(3);
			expect(result[0].id).to.deep.equal("ubc");
			expect(result[1].id).to.deep.equal("ubc2");
			expect(result[2].id).to.deep.equal("ubc3");
		});
		it("should have 1 after removal", async function () {
			const test = await getContentFromArchives("valid.zip");
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			await facade.addDataset("ubc2", test, InsightDatasetKind.Sections);
			await facade.removeDataset("ubc2");
			const result = await facade.listDatasets();
			expect(result.length).to.deep.equal(1);
			expect(result[0].id).to.deep.equal("ubc");
		});
		it("should have 0 after removal", async function () {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			await facade.removeDataset("ubc");
			const result = await facade.listDatasets();
			expect(result.length).to.deep.equal(0);
		});
	});

    describe("PerformQuery - Checkpoint 2", function () {
        before(async function () {
            await clearDisk();
            facade = new InsightFacade();
            await facade.addDataset("sections", sections, InsightDatasetKind.Sections);
            await facade.addDataset("rooms", campus, InsightDatasetKind.Rooms);
        });
    
        after(async function () {
            await clearDisk();
        });
    
        describe("TRANSFORMATIONS - GROUP", function () {
            it("should group by single key", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: []
                    }
                };
                const result = await facade.performQuery(query);
                expect(result).to.be.an("array");
                expect(result.length).to.be.greaterThan(0);
            });
    
            it("should group by multiple keys", async function () {
                const query = {
                    WHERE: {
                        GT: { sections_avg: 90 }
                    },
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "sections_instructor"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept", "sections_instructor"],
                        APPLY: []
                    }
                };
                const result = await facade.performQuery(query);
                expect(result).to.be.an("array");
                expect(result.length).to.be.greaterThan(0);
            });
    
            it("should reject if COLUMNS not in GROUP or APPLY", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "sections_avg"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: []
                    }
                };
                try {
                    await facade.performQuery(query);
                    expect.fail("should have thrown error");
                } catch (err) {
                    expect(err).to.be.instanceof(InsightError);
                }
            });
        });
    
        describe("TRANSFORMATIONS - APPLY", function () {
            it("should apply MAX", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "maxAvg"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: [{
                            maxAvg: {
                                MAX: "sections_avg"
                            }
                        }]
                    }
                };
                const result = await facade.performQuery(query);
                expect(result).to.be.an("array");
                expect(result[0]).to.have.property("maxAvg");
                expect(result[0].maxAvg).to.be.a("number");
            });
    
            it("should apply MIN", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "minAvg"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: [{
                            minAvg: {
                                MIN: "sections_avg"
                            }
                        }]
                    }
                };
                const result = await facade.performQuery(query);
                expect(result).to.be.an("array");
                expect(result[0]).to.have.property("minAvg");
                expect(result[0].minAvg).to.be.a("number");
            });
    
            it("should apply AVG with decimal precision", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "avgGrade"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: [{
                            avgGrade: {
                                AVG: "sections_avg"
                            }
                        }]
                    }
                };
                const result = await facade.performQuery(query);
                expect(result).to.be.an("array");
                expect(result[0]).to.have.property("avgGrade");
                const avgValue = result[0].avgGrade as number;
                const decimalPlaces = (avgValue.toString().split(".")[1] || "").length;
                expect(decimalPlaces).to.be.at.most(2);
            });
    
            it("should apply SUM", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "totalPass"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: [{
                            totalPass: {
                                SUM: "sections_pass"
                            }
                        }]
                    }
                };
                const result = await facade.performQuery(query);
                expect(result).to.be.an("array");
                expect(result[0]).to.have.property("totalPass");
                expect(result[0].totalPass).to.be.a("number");
            });
    
            it("should apply COUNT", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "numInstructors"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: [{
                            numInstructors: {
                                COUNT: "sections_instructor"
                            }
                        }]
                    }
                };
                const result = await facade.performQuery(query);
                expect(result).to.be.an("array");
                expect(result[0]).to.have.property("numInstructors");
                expect(result[0].numInstructors).to.be.a("number");
            });
    
            it("should handle multiple APPLY rules", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "avgGrade", "maxGrade", "totalStudents"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: [
                            { avgGrade: { AVG: "sections_avg" } },
                            { maxGrade: { MAX: "sections_avg" } },
                            { totalStudents: { SUM: "sections_pass" } }
                        ]
                    }
                };
                const result = await facade.performQuery(query);
                expect(result).to.be.an("array");
                expect(result[0]).to.have.property("avgGrade");
                expect(result[0]).to.have.property("maxGrade");
                expect(result[0]).to.have.property("totalStudents");
            });
    
            it("should reject duplicate applykey", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "avgGrade"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: [
                            { avgGrade: { AVG: "sections_avg" } },
                            { avgGrade: { MAX: "sections_avg" } }
                        ]
                    }
                };
                try {
                    await facade.performQuery(query);
                    expect.fail("should have thrown error");
                } catch (err) {
                    expect(err).to.be.instanceof(InsightError);
                }
            });
    
            it("should reject applykey with underscore", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "avg_grade"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: [{
                            avg_grade: {
                                AVG: "sections_avg"
                            }
                        }]
                    }
                };
                try {
                    await facade.performQuery(query);
                    expect.fail("should have thrown error");
                } catch (err) {
                    expect(err).to.be.instanceof(InsightError);
                }
            });
    
            it("should reject MAX on string field", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "maxDept"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: [{
                            maxDept: {
                                MAX: "sections_dept"
                            }
                        }]
                    }
                };
                try {
                    await facade.performQuery(query);
                    expect.fail("should have thrown error");
                } catch (err) {
                    expect(err).to.be.instanceof(InsightError);
                }
            });
    
            it("should reject missing GROUP", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["avgGrade"]
                    },
                    TRANSFORMATIONS: {
                        APPLY: [{
                            avgGrade: {
                                AVG: "sections_avg"
                            }
                        }]
                    }
                };
                try {
                    await facade.performQuery(query);
                    expect.fail("should have thrown error");
                } catch (err) {
                    expect(err).to.be.instanceof(InsightError);
                }
            });
    
            it("should reject missing APPLY", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"]
                    }
                };
                try {
                    await facade.performQuery(query);
                    expect.fail("should have thrown error");
                } catch (err) {
                    expect(err).to.be.instanceof(InsightError);
                }
            });
        });
    
        describe("ORDER - New Format", function () {
    
            it("should sort with multiple keys", async function () {
                const query = {
                    WHERE: {
                        GT: { sections_avg: 97 }
                    },
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "sections_avg"],
                        ORDER: {
                            dir: "UP",
                            keys: ["sections_dept", "sections_avg"]
                        }
                    }
                };
                const result = await facade.performQuery(query);
                expect(result).to.be.an("array");
                expect(result.length).to.be.greaterThan(0);
            });
    
            it("should reject invalid direction", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "sections_avg"],
                        ORDER: {
                            dir: "MIDDLE",
                            keys: ["sections_avg"]
                        }
                    }
                };
                try {
                    await facade.performQuery(query);
                    expect.fail("should have thrown error");
                } catch (err) {
                    expect(err).to.be.instanceof(InsightError);
                }
            });
    
            it("should reject ORDER key not in COLUMNS", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept"],
                        ORDER: {
                            dir: "UP",
                            keys: ["sections_avg"]
                        }
                    }
                };
                try {
                    await facade.performQuery(query);
                    expect.fail("should have thrown error");
                } catch (err) {
                    expect(err).to.be.instanceof(InsightError);
                }
            });
    
            it("should reject empty keys array", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept"],
                        ORDER: {
                            dir: "UP",
                            keys: []
                        }
                    }
                };
                try {
                    await facade.performQuery(query);
                    expect.fail("should have thrown error");
                } catch (err) {
                    expect(err).to.be.instanceof(InsightError);
                }
            });
        });
    
    
        describe("Multiple Dataset Validation", function () {
            it("should reject query referencing both sections and rooms", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "rooms_name"]
                    }
                };
                try {
                    await facade.performQuery(query);
                    expect.fail("should have thrown error");
                } catch (err) {
                    expect(err).to.be.instanceof(InsightError);
                }
            });
    
            it("should reject transformations with mixed datasets", async function () {
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["sections_dept", "avgSeats"]
                    },
                    TRANSFORMATIONS: {
                        GROUP: ["sections_dept"],
                        APPLY: [{
                            avgSeats: {
                                AVG: "rooms_seats"
                            }
                        }]
                    }
                };
                try {
                    await facade.performQuery(query);
                    expect.fail("should have thrown error");
                } catch (err) {
                    expect(err).to.be.instanceof(InsightError);
                }
            });
        });
    
        describe("Caching and Persistence", function () {
            it("should persist and load sections dataset across instances", async function () {
                await clearDisk();
                const facade1 = new InsightFacade();
                await facade1.addDataset("test", sections, InsightDatasetKind.Sections);
                
                const facade2 = new InsightFacade();
                const query = {
                    WHERE: {
                        GT: { test_avg: 95 }
                    },
                    OPTIONS: {
                        COLUMNS: ["test_dept"]
                    }
                };
                const result = await facade2.performQuery(query);
                expect(result).to.be.an("array");
                expect(result.length).to.be.greaterThan(0);
            });
    
            it("should persist and load rooms dataset across instances", async function () {
                await clearDisk();
                const facade1 = new InsightFacade();
                await facade1.addDataset("testrooms", campus, InsightDatasetKind.Rooms);
                
                const facade2 = new InsightFacade();
                const query = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: ["testrooms_name"]
                    }
                };
                const result = await facade2.performQuery(query);
                expect(result).to.be.an("array");
            });
        });
    });
});
