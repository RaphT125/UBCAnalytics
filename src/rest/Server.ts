import express from "express";
import cors from "cors";
import http from "http";
import { Log } from "@ubccpsc310/project-support";
import * as fs from "fs-extra";
import { InsightDatasetKind, NotFoundError } from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";

export default class Server {
	private port: number;
	public express: express.Application;
	private server: http.Server | null = null;
	private insightFacade: InsightFacade;

	constructor(port: number) {
		this.port = port;
		this.express = express();
		this.insightFacade = new InsightFacade();
	}

	private middleWare() {
		this.express.use(express.json());
		this.express.use(express.raw({ type: "application/*", limit: "10mb" }));
		this.express.use(cors());
	}

	//used gpt the following code
	private addRoute() {
        this.express.put("/dataset/:id/:kind", async (req, res) => {
            const id = req.params.id;
            try {
                const kind = this.kindCoverter(req.params.kind);
                
                console.log("req.body type:", typeof req.body);
                console.log("Is Buffer?", Buffer.isBuffer(req.body));
                console.log("req.body:", req.body);
                
                let content: string;
                
                if (Buffer.isBuffer(req.body)) {
                    content = req.body.toString("base64");
                } else if (typeof req.body === "string") {
                    const buffer = await fs.readFile(req.body);
                    content = buffer.toString("base64");
                } else {
                    throw new Error("Invalid request body format");
                }
                
                const response = await this.insightFacade.addDataset(id, content, kind);
                res.status(200).json({ response });
            } catch (err) {
                res.status(400).json({ error: String(err) });
            }
        });
    }

	private kindCoverter(kind: string): InsightDatasetKind {
		if (kind === "Sections") {
			return InsightDatasetKind.Sections;
		} else if (kind === "Rooms") {
			return InsightDatasetKind.Rooms;
		} else {
			throw new Error("Not valid kind");
		}
	}

	private deleteRoute() {
		this.express.delete("/dataset/:id", async (req, res) => {
			const id = req.params.id;
			try {
				const response = await this.insightFacade.removeDataset(id);
				res.status(200).json({ response });
			} catch (err) {
				if (err instanceof NotFoundError) {
					res.status(404).json("file not found");
				} else {
					res.status(400).json({ error: String(err) });
				}
			}
		});
	}

	private queryRoute() {
		//gpt debugged
		this.express.post("/dataset/", async (req, res) => {
			const query = req.body;
			try {
				const response = await this.insightFacade.performQuery(query);
				res.status(200).json({ response });
			} catch (err) {
				res.status(400).json({ error: String(err) });
			}
		});
	}

	private listDatasetRoute() {
		this.express.get("/dataset/", async (req, res) => {
			try {
				const response = await this.insightFacade.listDatasets();
				res.status(200).json({ response });
			} catch (err) {
				res.status(400).json({ error: String(err) });
			}
		});
	}

	public start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.middleWare();
			this.addRoute();
			this.deleteRoute();
			this.queryRoute();
			this.listDatasetRoute();
			if (this.server != null) {
				return reject("Server already started");
			}
			try {
				this.server = this.express.listen(this.port);
				Log.info("Server starting in " + this.port);
				resolve();
			} catch (e) {
				return reject("failed to start server: " + e);
			}
		});
	}

	public stop(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.server == null) {
				return reject("Server not started");
			}
			try {
				this.server.close();
				Log.info("Server stopped");
				resolve();
			} catch (e) {
				return reject("failed to stop server: " + e);
			}
		});
	}
}
