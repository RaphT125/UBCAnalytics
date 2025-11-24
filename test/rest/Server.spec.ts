import { expect } from "chai";
import request from "supertest";
import Server from "../../src//rest/Server";
import { clearDisk } from "../TestUtil";
describe("IntegrationTesting", function () {
	let localURL = "http://localhost:4321";
	let server: Server;
	let buffer: string;
	let invalidRoot: string;
	before(async function () {
		buffer = "test/resources/archives/pair.zip";
		invalidRoot = "test/resources/archives/invalidroot2.zip";
		this.server = new Server(4321);
		await this.server.start();
		await clearDisk();
	});

	after(async function () {
		await this.server.stop();
		this.server = null;
	});

	describe("AddDataset", function () {
		beforeEach(async function () {
			await clearDisk();
		});
		it("Should accept, valid room added", async function () {
			const temp = await request(localURL)
				.put("/dataset/ubc/Sections")
				.set("Content-Type", "application/x-zip-compressed")
				.send(buffer);
			expect(temp.status).to.equal(200);
			expect(temp.body.response[0]).to.deep.equal("ubc");
		});
		it("Should reject, invalid kind", async function () {
			const temp = await request(localURL)
				.put("/dataset/ubc/thing")
				.set("Content-Type", "application/x-zip-compressed")
				.send(buffer);
			expect(temp.status).to.equal(400);
		});
		it("Should reject, invalidIDFromInsightFacade", async function () {
			const temp = await request(localURL)
				.put("/dataset/ub_c/Sections")
				.set("Content-Type", "application/x-zip-compressed")
				.send(buffer);
			expect(temp.status).to.equal(400);
		});
		it("Should reject, sameIDAddedTwice", async function () {
			await request(localURL)
				.put("/dataset/ubc/Sections")
				.set("Content-Type", "application/x-zip-compressed")
				.send(buffer);
			const temp = await request(localURL)
				.put("/dataset/ubc/Sections")
				.set("Content-Type", "application/x-zip-compressed")
				.send(buffer);
			expect(temp.status).to.equal(400);
		});
		it("Should reject, invalidRoot", async function () {
			const temp = await request(localURL)
				.put("/dataset/ubc/Sections")
				.set("Content-Type", "application/x-zip-compressed")
				.send(invalidRoot);
			expect(temp.status).to.equal(400);
		});
	});

	describe("removeDataset", function () {
		beforeEach(async function () {
			await clearDisk();
		});
		it("Should accept, valid remove", async function () {
			await request(localURL)
				.put("/dataset/ubc/Sections")
				.set("Content-Type", "application/x-zip-compressed")
				.send(buffer);

			const temp = await request(localURL).delete("/dataset/ubc");
			expect(temp.status).to.equal(200);
			expect(temp.body.response).to.deep.equal("ubc");
		});
		it("Should reject, no file found", async function () {
			const temp = await request(localURL).delete("/dataset/ubc");
			expect(temp.status).to.equal(404);
		});
		it("Should reject, no file found 2", async function () {
			await request(localURL)
				.put("/dataset/ubc/Sections")
				.set("Content-Type", "application/x-zip-compressed")
				.send(buffer);

			const temp = await request(localURL).delete("/dataset/ubc1");
			expect(temp.status).to.equal(404);
		});
		it("Should reject, invalid id", async function () {
			await request(localURL)
				.put("/dataset/ubc/Sections")
				.set("Content-Type", "application/x-zip-compressed")
				.send(buffer);

			const temp = await request(localURL).delete("/dataset/ubc_");
			expect(temp.status).to.equal(400);
		});
	});

	describe("queryData", function () {
		beforeEach(async function () {
			await clearDisk();
			await request(localURL)
				.put("/dataset/sections/Sections")
				.set("Content-Type", "application/x-zip-compressed")
				.send(buffer);
		});
		it("Should accept, valid query", async function () {
			const query = {
				WHERE: {
					GT: {
						sections_avg: 97,
					},
				},
				OPTIONS: {
					COLUMNS: ["sections_dept", "sections_avg"],
					ORDER: "sections_avg",
				},
			};
			const temp = await request(localURL).post("/dataset/").set("Content-Type", "application/json").send(query);
			expect(temp.status).to.equal(200);
		});
		it("Should reject, invalid query, dataset doesn't exist", async function () {
			const query = {
				WHERE: {
					GT: {
						section_avg: 97,
					},
				},
				OPTIONS: {
					COLUMNS: ["sections_dept", "sections_avg"],
					ORDER: "sections_avg",
				},
			};
			const temp = await request(localURL).post("/dataset/").set("Content-Type", "application/json").send(query);
			expect(temp.status).to.equal(400);
		});
		it("Should reject, invalid query, bad query", async function () {
			const query = {
				OPTIONS: {},
			};
			const temp = await request(localURL).post("/dataset/").set("Content-Type", "application/json").send(query);
			expect(temp.status).to.equal(400);
		});
	});

	describe("listData", function () {
		beforeEach(async function () {
			await clearDisk();
		});
		it("Should accept, valid query", async function () {
			await request(localURL)
				.put("/dataset/ubc/Sections")
				.set("Content-Type", "application/x-zip-compressed")
				.send(buffer);
			const temp = await request(localURL).get("/dataset/");
			expect(temp.status).to.equal(200);
			expect(temp.body.response[0].id).to.deep.equal("ubc");
		});
	});
});
