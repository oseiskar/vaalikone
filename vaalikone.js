"use strict";
/* globals _, d3 */

function Vaalikone(questions, answers) {

    const partyAnswers = d3.nest()
        .key(d => d.person.party)
        .entries(answers);

    this.subplotSize = {
        w: 200,
        h: 50
    };

    this.questions = questions;
    this.answers = answers;
    this.parties = partyAnswers.map(d => d.key);
    this.partyAnswerMatrix = _.fromPairs(
        partyAnswers.map(group => [
            group.key,
            _.fromPairs(
                _.keys(questions).map(q => [
                    q,
                    group.values.map(d => d.answers[q])
                ])
            )
        ])
    );

    this.answerOptions = _.uniq(
        _.flatten(answers.map(d => _.values(d.answers)))
    );
    this.answerOptions.sort();

    //console.log(this.answerOptions);
    //console.log(this.partyAnswerMatrix);
}

Vaalikone.prototype.renderHistogram = function(d3root, data) {

    const total = _.sum(_.values(data));

    const barWidth = this.subplotSize.w / (this.answerOptions.length+1);
    const minX = d3.min(this.answerOptions);
    const maxR = barWidth / Math.sqrt(2);
    const maxHeight = this.subplotSize.h;
    const xStart = 0.5 / Math.sqrt(2) * barWidth;

    const colorScale = d3.scaleLinear()
        .domain([minX, d3.max(this.answerOptions)])
        .range([0, 1]);

    const rgb = (arr) => 'rgb('+arr.map(x => x*255).map(Math.round).join(',')+')';


    const color = x => {
        let c = colorScale(x);

        let sat = Math.sqrt(Math.abs(Math.pow(c, 1.5) - 0.5)*2.0);
        const bright = sat*0.3 + 0.7;

        return rgb([
                1.0 - (c-0.5)*2,
                c*2,
                0.0
            ]
            .map(v => Math.min(Math.max(v, 0), 1))
            .map(v => (v*sat + 1.0 - sat)*bright));
    };

    //const height = x => (data[x] || 0) / total * maxHeight;
    const radius = x => Math.sqrt((data[x] || 0) / total) * maxR;

    const bars = d3root
        .selectAll('circle')
        .data(this.answerOptions);

    bars.exit().remove();

    bars
        .enter()
            .append('circle')
            .attr('cx', x => (x-minX + 0.5) * barWidth + xStart)
            //.attr('width', barWidth)
            .attr('fill', color)
        .merge(bars)
            .attr('cy', maxHeight*0.5)
            .attr('r', radius);
            //.attr('height', height);
};

Vaalikone.prototype.renderQuestion = function(d3root, questionId) {

    const options = this.answerOptions;
    const byParty = _.mapValues(this.partyAnswerMatrix,
        answers => _.fromPairs(d3.nest()
            .key(d => d).sortKeys(d3.ascending)
            .rollup(d => d.length)
            .entries(answers[questionId])
            .map(obj => [obj.key, obj.value])));

    console.log(byParty);

    const that = this;

    const subplots = d3root
        .selectAll('div.row')
        .data(_.keys(byParty));

    subplots.exit().remove();

    const figures = subplots.enter()
        .append('div')
        .classed('row', true);

    figures
        .append('div')
        .classed('col-4', true)
        .classed('title', true);

    figures.select('div.title').text(d => d);

    figures
        .append('div')
        .classed('col', true)
            .append('svg')
                .attr('width', this.subplotSize.w)
                .attr('height', this.subplotSize.h)
            .merge(subplots)
                .each(function(d) {
                    that.renderHistogram(d3.select(this), byParty[d]);
                });

};

Vaalikone.prototype.start = function(d3root) {

    const that = this;

    const container = d3root
        .append('div')
        .classed('row', true);

    const NO_ACTION = 'javascript:void(0)';

    const questionList =
        container
            .append('div')
            .classed('question-column', true)
                .append('ul');

    const graphs =
        container
            .append('div')
            .classed('graph-column', true);

    questionList
        .selectAll('li')
        .data(_.toPairs(this.questions))
        .enter()
        .append('li')
            .append('a')
            .attr('href', NO_ACTION)
            .text(d => d[1])
            .on('click', d => that.renderQuestion(graphs, d[0]));
};
