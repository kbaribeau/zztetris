// A separator belongs to the preceding queue segment. Project pieces independently
// of raw token indexes so even short/custom segments keep all six preview slots.
function drawQueuePreview(queue, holdP, imgs, ctxN, ctxH) {
	ctxN.clearRect(0, 0, 90, 360);
	ctxH.clearRect(0, 0, 90, 60);
	let slots = 0;
	const ends = new Set();
	for (const token of queue) {
		if (token === '|') {
			if (slots <= 6) ends.add(slots);
		} else {
			if (slots === 6) break;
			// Unknown imported tokens retain their slot; they are not guessed or drawn.
			if (imgs[token]) ctxN.drawImage(imgs[token], 0, slots * 60);
			slots++;
		}
	}
	// The outgoing piece can already be active (leading separator). In that
	// case only its top-edge cue remains in the preview. All strokes stay inside
	// the canvas, including a marker on the sixth piece at the bottom edge.
	ctxN.strokeStyle = '#fff';
	ctxN.lineWidth = 2;
	for (const end of TrainingSettings.bagBoundaries ? ends : []) {
		const y = end === 0 ? 2 : end * 60 - 2;
		ctxN.beginPath();
		ctxN.moveTo(70, y);
		ctxN.lineTo(88, y);
		ctxN.lineTo(88, end === 0 ? 18 : y - 16);
		ctxN.stroke();
	}
	if (holdP && imgs[holdP]) ctxH.drawImage(imgs[holdP], 0, 0);
}

function mirror() {
	for (row = 0; row < board.length; row++) {
		board[row].reverse();
		for (i = 0; i < board[row].length; i++) {
			if (board[row][i].t == 1) board[row][i].c = reversed[board[row][i].c];
		}
	}
	for (i = 0; i < queue.length; i++) {
		queue[i] = reversed[queue[i]];
	}
	holdP = reversed[holdP];
	piece = reversed[piece];

	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	clearActive();
	updateGhost();
	updateQueue();
	setShape();
	updateHistory();
}

function fullMirror() {
	for (i = 0; i < hist.length; i++) {
		tempBoard = JSON.parse(hist[i]['board']);
		for (row = 0; row < tempBoard.length; row++) {
			tempBoard[row].reverse();
			for (j = 0; j < tempBoard[row].length; j++) {
				if (tempBoard[row][j].t == 1) tempBoard[row][j].c = reversed[tempBoard[row][j].c];
			}
		}
		hist[i]['board'] = JSON.stringify(tempBoard);
		tempQueue = JSON.parse(hist[i]['queue']);
		for (j = 0; j < tempQueue.length; j++) {
			tempQueue[j] = reversed[tempQueue[j]];
		}
		hist[i]['queue'] = JSON.stringify(tempQueue);

		hist[i]['hold'] = reversed[hist[i]['hold']];
		hist[i]['piece'] = reversed[hist[i]['piece']];
	}
	board = tempBoard;
	queue = tempQueue;
	holdP = reversed[holdP];
	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	updateQueue();
	clearActive();
	updateGhost();
	setShape();
}

function garbage(column, amount = 1) {
	for (i = 0; i < amount; i++) {
		garbageRow = new Array(10).fill({ t: 1, c: 'X' });
		garbageRow[column] = { t: 0, c: '' };
		board.shift();
		board.push(garbageRow);
	}
	xPOS = spawn[0];
	yPOS = spawn[1];
	updateGhost();
}
