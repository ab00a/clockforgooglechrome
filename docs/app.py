#!/usr/bin/env python
import flask

app = flask.Flask(__name__)

@app.route("/")
def home():
   return flask.redirect("https://clockforchrome.appspot.com/site/index.html")